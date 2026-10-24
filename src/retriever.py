"""
UniRadar Hybrid Retriever
Combines Dense Semantic Search (SentenceTransformer all-MiniLM-L6-v2)
and Lexical Keyword Search (BM25s / BM25) with Reciprocal Rank Fusion (RRF)
and local embedding caching.
"""

from __future__ import annotations
import os
import re
import json
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from src.models import Announcement, SearchResult

# Try importing dense & lexical backends with graceful fallbacks
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    import bm25s
    BM25S_AVAILABLE = True
except ImportError:
    BM25S_AVAILABLE = False


class HybridRetriever:
    """
    State-of-the-art hybrid search engine combining dense semantic embeddings
    and lexical BM25 matching, optimized for UM6P campus announcements.
    """

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        cache_path: str = "data/cache_embeddings.npy",
        alpha: float = 0.55  # Weight for dense vs lexical
    ):
        self.model_name = model_name
        self.cache_path = cache_path
        self.alpha = alpha

        self.announcements: List[Announcement] = []
        self.doc_texts: List[str] = []
        self.embeddings: Optional[np.ndarray] = None
        self.bm25_retriever: Any = None
        self._model: Any = None

    def _get_embedding_model(self):
        """Lazy load embedding model to conserve memory and startup time."""
        if self._model is None and SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self._model = SentenceTransformer(self.model_name)
            except Exception as e:
                print(f"[Warning] Could not load SentenceTransformer {self.model_name}: {e}")
                self._model = None
        return self._model

    def _tokenize_text(self, text: str) -> List[str]:
        """Simple multilingual tokenizer supporting Darija, French, and English."""
        # Normalize arabic/darija characters, punctuation, and lowercase
        cleaned = re.sub(r"[^\w\s]", " ", text.lower())
        tokens = [t for t in cleaned.split() if len(t) > 1]
        return tokens

    def index_announcements(self, announcements: List[Announcement], force_rebuild: bool = False) -> None:
        """
        Builds both lexical and dense indices over announcements.
        Caches dense embeddings locally to disk for instant subsequent queries.
        """
        self.announcements = announcements
        self.doc_texts = [ann.to_searchable_text() for ann in announcements]

        if not self.announcements:
            return

        # 1. Lexical Index (BM25s or fallback)
        self._build_lexical_index()

        # 2. Dense Semantic Index (SentenceTransformer + Cache)
        self._build_dense_index(force_rebuild=force_rebuild)

    def _build_lexical_index(self) -> None:
        """Builds BM25 index over documents."""
        if BM25S_AVAILABLE and self.doc_texts:
            try:
                tokenized_corpus = [self._tokenize_text(doc) for doc in self.doc_texts]
                self.bm25_retriever = bm25s.BM25(corpus=self.announcements)
                self.bm25_retriever.index(tokenized_corpus, show_progress=False)
            except Exception as e:
                print(f"[Warning] BM25s indexing error: {e}")
                self.bm25_retriever = None

    def _build_dense_index(self, force_rebuild: bool = False) -> None:
        """Builds or loads cached embeddings."""
        model = self._get_embedding_model()
        if model is None:
            # Fallback lightweight bag-of-words / pseudo-embedding
            self._build_fallback_embeddings()
            return

        # Check local cache
        if (
            not force_rebuild
            and os.path.exists(self.cache_path)
            and len(self.doc_texts) > 0
        ):
            try:
                cached = np.load(self.cache_path)
                if cached.shape[0] == len(self.doc_texts):
                    self.embeddings = cached
                    return
            except Exception:
                pass

        # Compute embeddings
        try:
            embeddings = model.encode(
                self.doc_texts,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
            self.embeddings = embeddings
            # Save to cache
            os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
            np.save(self.cache_path, self.embeddings)
        except Exception as e:
            print(f"[Warning] Dense embedding computation failed: {e}")
            self._build_fallback_embeddings()

    def _build_fallback_embeddings(self) -> None:
        """Lightweight fallback vectorizer if transformer model is not loaded."""
        vocab = set()
        for doc in self.doc_texts:
            vocab.update(self._tokenize_text(doc))
        vocab_list = sorted(list(vocab))
        vocab_idx = {w: i for i, w in enumerate(vocab_list)}

        dim = max(len(vocab_list), 1)
        matrix = np.zeros((len(self.doc_texts), dim), dtype=np.float32)
        for i, doc in enumerate(self.doc_texts):
            for token in self._tokenize_text(doc):
                if token in vocab_idx:
                    matrix[i, vocab_idx[token]] += 1.0
            norm = np.linalg.norm(matrix[i])
            if norm > 0:
                matrix[i] /= norm
        self.embeddings = matrix

    @staticmethod
    def extract_location_filter(query: str) -> Optional[str]:
        """
        Extracts requested campus or city constraint from query in Darija, French, or English.
        Examples:
        - 'f marrakech', 'à marrakech', 'in marrakech', 'marrakech', 'kech' -> 'Marrakech'
        - 'f rabat', 'à rabat', 'in rabat', 'rabat', 'salé' -> 'Rabat'
        - 'f ben guerir', 'benguerir', 'ben guerir' -> 'Ben Guerir'
        - 'f casa', 'casablanca', 'in casablanca' -> 'Casablanca'
        """
        q_lower = query.lower()

        # Check Ben Guerir variations
        if any(term in q_lower for term in ["ben guerir", "benguerir", "bengrir", "ben-guerir"]):
            return "Ben Guerir"

        # Check Rabat / Salé variations
        if re.search(r"\b(rabat|salé|sale)\b", q_lower):
            return "Rabat"

        # Check other Moroccan cities
        for city in ["marrakech", "marrakesh", "kech", "casablanca", "casa", "tanger", "tangier", "agadir", "fes", "fez", "meknes", "oujda"]:
            if re.search(rf"\b{city}\b", q_lower):
                if city in ["marrakech", "marrakesh", "kech"]:
                    return "Marrakech"
                if city in ["casablanca", "casa"]:
                    return "Casablanca"
                return city.capitalize()

        return None

    def search(
        self,
        query: str,
        top_k: int = 5,
        filter_campus: Optional[str] = None,
        min_score_threshold: float = 0.25
    ) -> List[SearchResult]:
        """
        Executes strict hybrid search combining dense semantic similarity and BM25 lexical match.
        Enforces explicit location filtering and calibrated relevance thresholds.
        """
        if not self.announcements:
            return []

        # 1. Location / Campus Detection
        target_loc = filter_campus or self.extract_location_filter(query)

        # If a specific location was requested, verify if ANY announcement exists in that location
        if target_loc:
            has_matching_loc = any(
                target_loc.lower() in ann.campus.lower()
                or target_loc.lower() in ann.venue.lower()
                or target_loc.lower() in ann.description.lower()
                for ann in self.announcements
            )
            # If the user asks for a city with no events at all (e.g. Marrakech), strictly return empty
            if not has_matching_loc:
                return []

        n_docs = len(self.announcements)
        dense_scores = np.zeros(n_docs, dtype=np.float32)
        bm25_scores = np.zeros(n_docs, dtype=np.float32)

        # 2. Compute Dense Semantic Scores
        model = self._get_embedding_model()
        if model is not None and self.embeddings is not None and self.embeddings.shape[0] == n_docs:
            try:
                q_emb = model.encode([query], convert_to_numpy=True, normalize_embeddings=True)[0]
                dense_scores = np.dot(self.embeddings, q_emb)
            except Exception:
                pass
        elif self.embeddings is not None and self.embeddings.shape[0] == n_docs:
            # Fallback vector matching
            q_tokens = self._tokenize_text(query)
            q_vec = np.zeros(self.embeddings.shape[1], dtype=np.float32)
            for t in q_tokens:
                idx = hash(t) % self.embeddings.shape[1]
                q_vec[idx] += 1.0
            q_norm = np.linalg.norm(q_vec)
            if q_norm > 0:
                q_vec /= q_norm
                dense_scores = np.dot(self.embeddings, q_vec)

        # 3. Compute BM25 Lexical Scores
        q_tokens = self._tokenize_text(query)
        if BM25S_AVAILABLE and self.bm25_retriever is not None and q_tokens:
            try:
                results, scores = self.bm25_retriever.retrieve(
                    [q_tokens],
                    k=min(n_docs, top_k * 2),
                    show_progress=False
                )
                if len(scores) > 0 and len(scores[0]) > 0:
                    retrieved_docs = results[0]
                    retrieved_scores = scores[0]
                    for d_idx, doc in enumerate(retrieved_docs):
                        for orig_i, orig_a in enumerate(self.announcements):
                            if orig_a.id == doc.id:
                                bm25_scores[orig_i] = float(retrieved_scores[d_idx])
                                break
            except Exception:
                pass

        # Fallback term overlap
        if np.max(bm25_scores) == 0.0 and q_tokens:
            for i, text in enumerate(self.doc_texts):
                doc_toks = set(self._tokenize_text(text))
                match_count = sum(1 for q in q_tokens if q in doc_toks)
                bm25_scores[i] = match_count / (len(q_tokens) + 1e-5)

        # 4. Calibrated Score Calculation (avoid relative min-max distortion)
        # Cosine similarity typically relevant >= 0.35; scale [0.25, 0.75] -> [0.0, 1.0]
        calibrated_dense = np.clip((dense_scores - 0.25) / 0.50, 0.0, 1.0)

        # Scale BM25 scores
        max_bm = np.max(bm25_scores)
        if max_bm > 0:
            calibrated_bm25 = np.clip(bm25_scores / (max_bm + 1e-6), 0.0, 1.0)
        else:
            calibrated_bm25 = np.zeros_like(bm25_scores)

        # Combine: alpha * dense + (1 - alpha) * bm25
        final_scores = (self.alpha * calibrated_dense) + ((1.0 - self.alpha) * calibrated_bm25)

        # Zero out irrelevant background noise (low cosine similarity + 0 BM25 hits)
        for i in range(n_docs):
            if dense_scores[i] < 0.28 and bm25_scores[i] == 0:
                final_scores[i] = 0.0

        # 5. Sort and filter
        ranked_indices = np.argsort(-final_scores)

        results: List[SearchResult] = []
        for idx in ranked_indices:
            ann = self.announcements[idx]

            # Strict location filtering
            if target_loc:
                loc_match = (
                    target_loc.lower() in ann.campus.lower()
                    or target_loc.lower() in ann.venue.lower()
                    or target_loc.lower() in ann.description.lower()
                )
                if not loc_match:
                    continue

            # Strict relevance threshold
            if final_scores[idx] < min_score_threshold:
                continue

            results.append(
                SearchResult(
                    announcement=ann,
                    score=float(final_scores[idx]),
                    dense_score=float(calibrated_dense[idx]),
                    bm25_score=float(calibrated_bm25[idx])
                )
            )
            if len(results) >= top_k:
                break

        return results
