import { createContext, useContext, useMemo, useState } from 'react';

export type Language = 'en' | 'fr';
const translations = {
  en: {
    dashboard: 'Dashboard', radar: 'Smart Radar', assistant: 'AI Assistant', calendar: 'My Calendar', profile: 'Profile', settings: 'Settings', search: 'Search events', signOut: 'Sign out', askUniRadar: 'Ask UniRadar',
    workspace: 'WORKSPACE', campusIntelligence: 'CAMPUS INTELLIGENCE', campusSignals: 'Campus signals', integrationPreview: 'Integration preview', appearance: 'Appearance', preferences: 'Preferences',
    dashboardTitle: 'Your campus overview', yourCampusInFocus: 'YOUR CAMPUS, IN FOCUS', goodToSeeYou: 'Good to see you,', tagline: 'Your campus, without the chaos.', addAnnouncement: 'Add announcement', atAGlance: 'AT A GLANCE', campusPulse: 'Campus pulse', relevantEvents: 'Relevant events', upcomingEvents: 'Upcoming events', scheduleConflicts: 'Schedule conflicts', crossCampusAlerts: 'Cross-campus alerts', comingUp: 'Coming up', exploreAllEvents: 'Explore all events', makeItYours: 'MAKE IT YOURS', smallActions: 'Small actions, clearer days.', keepDetailsClose: 'Keep campus details close when they’re useful.', uploadPoster: 'Upload a poster', imageOrPdf: 'Image or PDF', pasteAnnouncement: 'Paste an announcement', startHandoff: 'Start a handoff', askQuestion: 'Ask a question', openAssistant: 'Open assistant', openCalendar: 'Open calendar', seeNext: 'See what’s next', noUpcomingEvents: 'No upcoming events',
    radarTitle: 'Signals worth your time.', radarDescription: 'Find a sample of campus moments, with every demo result clearly marked.', filters: 'Filters', allCampuses: 'All campuses', allCategories: 'All categories', anyDate: 'Any date', next7Days: 'Next 7 days', next30Days: 'Next 30 days', anyRelevance: 'Any relevance', highMatch: '80%+ match', soonestFirst: 'Soonest first', bestMatch: 'Best match', currentView: 'in the current view', clearFilters: 'Clear filters',
    calendarTitle: 'A little more room to plan.', calendarDescription: 'Calendar exports use only events with explicit valid dates and timezone information.', eventsInView: 'in this view', addToCalendar: 'Add to calendar', details: 'Details',
    studentProfile: 'Student profile', settingsTitle: 'Make UniRadar feel right.', newConversation: 'New conversation', conversations: 'Conversations',
    lightTheme: 'Light', darkTheme: 'Dark', systemTheme: 'System', brightAndCalm: 'Bright and calm', lowLightWorkspace: 'Low-light workspace', followDevice: 'Follow your device', interfaceLanguage: 'Interface language',
    weeklyBusyTimes: 'Weekly busy times', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
    language: 'Language', account: 'Account', accountDetails: 'Account details', connectedServices: 'Connected services', campusAndInterests: 'Campus & interests', usePreferences: 'Use preferences to personalize a future connected feed.', managedByAuth: 'Managed by UniRadar authentication.', fullName: 'Full name', universityEmail: 'University email', campus: 'Campus', schoolProgram: 'School / program', interests: 'Interests', busyScheduleHelp: 'Choose blocks that should be treated as busy by a future schedule service.', cancel: 'Cancel', saveChanges: 'Save changes',
    yourSpace: 'YOUR SPACE', noMessagesYet: 'No messages yet', historyInBrowser: 'History stays in this browser session.', campusAssistant: 'Campus assistant', apiIntegrationPreview: 'API integration preview', clearerCampusStarts: 'A CLEARER CAMPUS STARTS HERE', whatsOnYourMind: 'What’s on your mind?', askNaturally: 'Ask naturally in English, French, or Darija. Connect the campus AI service to get grounded answers.', demoChatDisclosure: 'Demo mode · Replies do not use live campus data or analyze images.', imageSupportLimit: 'Images supported · up to 4 files / 10 MB each', enterToSend: 'Enter to send · Shift+Enter for a new line', chatPlaceholder: 'Ask about campus life…', attachImage: 'Attach image', sendMessage: 'Send message',
    relevantBadge: 'Relevant', crossCampusBadge: 'Cross-campus', scheduleConflictBadge: 'Schedule conflict', matchLabel: 'Match', viewDetails: 'View details', register: 'Register',
  },
  fr: {
    dashboard: 'Tableau de bord', radar: 'Radar intelligent', assistant: 'Assistant IA', calendar: 'Mon calendrier', profile: 'Profil', settings: 'Paramètres', search: 'Rechercher des événements', signOut: 'Se déconnecter', askUniRadar: 'Demander à UniRadar',
    workspace: 'ESPACE DE TRAVAIL', campusIntelligence: 'VIE DE CAMPUS', campusSignals: 'Signaux du campus', integrationPreview: 'Aperçu des intégrations', appearance: 'Apparence', preferences: 'Préférences',
    dashboardTitle: 'Votre aperçu du campus', yourCampusInFocus: 'VOTRE CAMPUS, EN UN COUP D’ŒIL', goodToSeeYou: 'Heureux de vous retrouver,', tagline: 'Votre campus, sans le chaos.', addAnnouncement: 'Ajouter une annonce', atAGlance: 'EN UN COUP D’ŒIL', campusPulse: 'La vie du campus', relevantEvents: 'Événements pertinents', upcomingEvents: 'Événements à venir', scheduleConflicts: 'Conflits d’emploi du temps', crossCampusAlerts: 'Alertes inter-campus', comingUp: 'À venir', exploreAllEvents: 'Voir tous les événements', makeItYours: 'À VOTRE IMAGE', smallActions: 'De petits gestes, des journées plus claires.', keepDetailsClose: 'Gardez les informations utiles du campus à portée de main.', uploadPoster: 'Importer une affiche', imageOrPdf: 'Image ou PDF', pasteAnnouncement: 'Coller une annonce', startHandoff: 'Démarrer un transfert', askQuestion: 'Poser une question', openAssistant: 'Ouvrir l’assistant', openCalendar: 'Ouvrir le calendrier', seeNext: 'Voir la suite', noUpcomingEvents: 'Aucun événement à venir',
    radarTitle: 'Les signaux qui comptent.', radarDescription: 'Découvrez des exemples d’actualités du campus, clairement signalés comme démo.', filters: 'Filtres', allCampuses: 'Tous les campus', allCategories: 'Toutes les catégories', anyDate: 'Toutes les dates', next7Days: '7 prochains jours', next30Days: '30 prochains jours', anyRelevance: 'Toute pertinence', highMatch: 'Correspondance 80 %+', soonestFirst: 'Les plus proches', bestMatch: 'Meilleure correspondance', currentView: 'dans cette vue', clearFilters: 'Effacer les filtres',
    calendarTitle: 'Planifiez avec un peu plus de sérénité.', calendarDescription: 'Les exports utilisent uniquement des dates et fuseaux horaires explicites et valides.', eventsInView: 'dans cette vue', addToCalendar: 'Ajouter au calendrier', details: 'Détails',
    studentProfile: 'Profil étudiant', settingsTitle: 'Personnalisez UniRadar.', newConversation: 'Nouvelle conversation', conversations: 'Conversations',
    lightTheme: 'Clair', darkTheme: 'Sombre', systemTheme: 'Système', brightAndCalm: 'Lumineux et apaisant', lowLightWorkspace: 'Espace à faible luminosité', followDevice: 'Suivre votre appareil', interfaceLanguage: 'Langue de l’interface',
    weeklyBusyTimes: 'Disponibilités hebdomadaires', morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir',
    language: 'Langue', account: 'Compte', accountDetails: 'Détails du compte', connectedServices: 'Services connectés', campusAndInterests: 'Campus et centres d’intérêt', usePreferences: 'Utilisez ces préférences pour personnaliser un futur fil connecté.', managedByAuth: 'Géré par l’authentification UniRadar.', fullName: 'Nom complet', universityEmail: 'E-mail universitaire', campus: 'Campus', schoolProgram: 'École / formation', interests: 'Centres d’intérêt', busyScheduleHelp: 'Indiquez les créneaux à considérer comme occupés par un futur service d’emploi du temps.', cancel: 'Annuler', saveChanges: 'Enregistrer les modifications',
    yourSpace: 'VOTRE ESPACE', noMessagesYet: 'Aucun message', historyInBrowser: 'L’historique reste dans cette session du navigateur.', campusAssistant: 'Assistant du campus', apiIntegrationPreview: 'Aperçu de l’intégration API', clearerCampusStarts: 'LE CAMPUS EN PLUS CLAIR', whatsOnYourMind: 'Que souhaitez-vous savoir ?', askNaturally: 'Posez votre question en anglais, français ou darija. Connectez le service IA du campus pour obtenir des réponses contextualisées.', demoChatDisclosure: 'Mode démo · Les réponses n’utilisent pas de données campus en direct et n’analysent pas les images.', imageSupportLimit: 'Images prises en charge · jusqu’à 4 fichiers de 10 Mo chacun', enterToSend: 'Entrée pour envoyer · Maj+Entrée pour une nouvelle ligne', chatPlaceholder: 'Posez une question sur la vie du campus…', attachImage: 'Joindre une image', sendMessage: 'Envoyer le message',
    relevantBadge: 'Pertinent', crossCampusBadge: 'Inter-campus', scheduleConflictBadge: 'Conflit d’emploi du temps', matchLabel: 'Correspondance', viewDetails: 'Voir les détails', register: 'S’inscrire',
  },
} as const satisfies Record<Language, Record<string, string>>;

type TranslationKey = keyof typeof translations.en;
interface LanguageValue { language: Language; setLanguage: (value: Language) => void; t: (key: TranslationKey) => string }
const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try { return localStorage.getItem('uniradar-language') === 'fr' ? 'fr' : 'en'; } catch { return 'en'; }
  });
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try { localStorage.setItem('uniradar-language', next); } catch { /* Optional preference. */ }
  };
  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
