import os
import json
import numpy as np
from sentence_transformers import SentenceTransformer

class HybridCampusRetriever:
    def __init__(self, index_path: str = "data/cache_embeddings.npy", store_path: str = "data/events_store.json"):
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.index_path = index_path
        self.store_path = store_path
        self.events = []
        self.embeddings = None
        self.load_store()

    def load_store(self):
        if os.path.exists(self.store_path):
            with open(self.store_path, "r", encoding="utf-8") as f:
                self.events = json.load(f)
        if os.path.exists(self.index_path) and len(self.events) > 0:
            self.embeddings = np.load(self.index_path)

    def save_store(self):
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(self.events, f, indent=2, ensure_ascii=False)
        if self.embeddings is not None:
            np.save(self.index_path, self.embeddings)

    def add_event(self, event_data):
        # Handle cases where Gemma returns a list or a single object
        if isinstance(event_data, list):
            for single_event in event_data:
                self.add_event(single_event)
            return

        if not isinstance(event_data, dict):
            return

        self.events.append(event_data)
        doc_text = f"{event_data.get('title', '')} {event_data.get('campus', '')} {event_data.get('summary', '')} {' '.join(event_data.get('tags', []))}"
        new_vec = self.model.encode([doc_text])[0]
        
        if self.embeddings is None or len(self.embeddings) == 0:
            self.embeddings = np.array([new_vec])
        else:
            self.embeddings = np.vstack([self.embeddings, new_vec])
        self.save_store()

    def search(self, query: str, top_k: int = 3) -> list:
        if not self.events or self.embeddings is None:
            return []

        # 1. Semantic Vector Score
        q_vec = self.model.encode([query])[0]
        norm_emb = self.embeddings / np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        norm_q = q_vec / np.linalg.norm(q_vec)
        cos_scores = np.dot(norm_emb, norm_q)
        dense_ranks = np.argsort(-cos_scores)

        # 2. Lexical / Keyword Token Matching
        q_tokens = set(query.lower().split())
        lex_scores = []
        for ev in self.events:
            corpus = f"{ev.get('title', '')} {ev.get('campus', '')} {ev.get('location_details', '')} {ev.get('summary', '')}".lower()
            score = sum(1.0 for token in q_tokens if token in corpus)
            lex_scores.append(score)
        lex_ranks = np.argsort(-np.array(lex_scores))

        # 3. Reciprocal Rank Fusion (RRF)
        rrf_scores = {}
        k_const = 60
        for rank, idx in enumerate(dense_ranks):
            rrf_scores[idx] = rrf_scores.get(idx, 0.0) + (1.0 / (k_const + rank + 1))
        for rank, idx in enumerate(lex_ranks):
            rrf_scores[idx] = rrf_scores.get(idx, 0.0) + (1.0 / (k_const + rank + 1))

        sorted_indices = sorted(rrf_scores.keys(), key=lambda i: rrf_scores[i], reverse=True)
        return [self.events[i] for i in sorted_indices[:top_k]]