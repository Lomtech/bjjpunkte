export type Lang = 'de' | 'en'

export const translations = {
  // ── Common ──────────────────────────────────────────────────────────────────
  common: {
    active:    { de: 'Aktiv',    en: 'Active' },
    inactive:  { de: 'Inaktiv', en: 'Inactive' },
    loading:   { de: 'Lädt…',   en: 'Loading…' },
    save:      { de: 'Speichern', en: 'Save' },
    cancel:    { de: 'Abbrechen', en: 'Cancel' },
    close:     { de: 'Schließen', en: 'Close' },
    back:      { de: 'Zurück',   en: 'Back' },
    today:     { de: 'Heute',    en: 'Today' },
    de:        { de: 'Deutsch',  en: 'German' },
    en:        { de: 'Englisch', en: 'English' },
  },

  // ── Portal header ────────────────────────────────────────────────────────────
  portal: {
    memberPortal:  { de: 'Mitglieder-Portal',  en: 'Member Portal' },
    contactGym:    { de: 'Bitte kontaktiere dein Gym.', en: 'Please contact your gym.' },
    notFound:      { de: 'Nicht gefunden',    en: 'Not found' },

    // Trainer check-in banner
    checkedIn:     { de: 'Du wurdest eingecheckt ✓', en: 'You were checked in ✓' },

    // GPS
    gpsCheckin:       { de: 'GPS Check-in',   en: 'GPS Check-in' },
    gpsSubtitle:      { de: 'Im Gym? Einmal tippen — automatisch eingecheckt.', en: 'At the gym? One tap — checked in automatically.' },
    gpsStart:         { de: 'GPS Check-in starten', en: 'Start GPS Check-in' },
    gpsLocating:      { de: 'Standort wird ermittelt…', en: 'Locating…' },
    gpsNoClass:       { de: 'Kein aktiver Kurs – Check-in ist nur während oder bis zu 3 Std. nach dem Training möglich.', en: 'No active class – check-in is only available during or up to 3 hours after training.' },
    gpsNotAvailable:  { de: 'GPS nicht verfügbar', en: 'GPS not available' },
    gpsError:         { de: 'Fehler beim GPS-Check-in', en: 'GPS check-in error' },
    gpsCheckedIn:     { de: 'Eingecheckt ✓', en: 'Checked in ✓' },

    // Tabs
    schedule:    { de: 'Stundenplan', en: 'Schedule' },
    profile:     { de: 'Profil',      en: 'Profile' },
    management:  { de: 'Verwaltung',  en: 'Management' },
    logbook:     { de: 'Logbuch',     en: 'Logbook' },

    // Schedule/calendar
    noTraining:  { de: 'Kein Training an diesem Tag.', en: 'No training on this day.' },
    live:        { de: 'LIVE', en: 'LIVE' },
    booked:      { de: 'Angemeldet', en: 'Booked' },
    waitlisted:  { de: 'Warteliste', en: 'Waitlist' },
    checkedInBadge: { de: 'Eingecheckt ✓', en: 'Checked in ✓' },
    soldOut:     { de: '· Ausgebucht', en: '· Sold out' },
    whosComing:  { de: 'Wer kommt', en: 'Who\'s coming' },
    book:        { de: 'Anmelden',   en: 'Book' },
    cancel:      { de: 'Abmelden',   en: 'Cancel' },
    waitlist:    { de: 'Auf Warteliste', en: 'Join waitlist' },
    cancelWaitlist: { de: 'Von Warteliste abmelden', en: 'Leave waitlist' },
    checkinNow:  { de: 'Jetzt einchecken', en: 'Check in now' },
    checkingIn:  { de: 'Einchecken…', en: 'Checking in…' },

    // Profile
    memberSince: { de: 'Mitglied seit', en: 'Member since' },
    total:       { de: 'Gesamt',    en: 'Total' },
    thisMonth:   { de: 'Diesen Monat', en: 'This month' },
    weekStreak:  { de: 'Wochen-Streak', en: 'Week streak' },

    // Plans
    membership:  { de: 'Mitgliedschaft', en: 'Membership' },
    currentPlan: { de: 'Aktuell:', en: 'Current:' },
    choosePlan:  { de: 'Wähle einen Tarif oder fordere einen Wechsel an.', en: 'Choose a plan or request a change.' },
    changeRequested: { de: 'Wechsel zu „{plan}" angefordert', en: 'Change to "{plan}" requested' },
    gymWillProcess:  { de: 'Dein Gym wird die Änderung bearbeiten.', en: 'Your gym will process the change.' },
    current:     { de: 'Aktuell',    en: 'Current' },
    requested:   { de: 'Angefordert', en: 'Requested' },
    cancelAnytime: { de: 'Jederzeit kündbar', en: 'Cancel anytime' },
    minDuration: { de: '{n} Monate Mindestlaufzeit', en: '{n} month minimum term' },
    choose:      { de: 'Wählen', en: 'Choose' },

    // Payments
    paymentHistory: { de: 'Zahlungshistorie', en: 'Payment history' },
    noPayments:     { de: 'Keine Zahlungen vorhanden.', en: 'No payments yet.' },
    payNow:         { de: 'Jetzt bezahlen', en: 'Pay now' },
    linkExpired:    { de: 'Link abgelaufen', en: 'Link expired' },

    // Attendance
    trainingHistory: { de: 'Trainingsverlauf', en: 'Training history' },
    noTrainingLogged: { de: 'Noch keine Trainings aufgezeichnet.', en: 'No training sessions recorded yet.' },
    moreEntries:     { de: '+ {n} weitere Einträge', en: '+ {n} more entries' },

    // Logbook
    techLogbook:     { de: 'Technik-Logbuch', en: 'Technique logbook' },
    logPlaceholder:  { de: 'Was hast du heute gelernt oder geübt?', en: 'What did you learn or practice today?' },
    classOptional:   { de: 'Klasse (optional)', en: 'Class (optional)' },
    noNotes:         { de: 'Noch keine Notizen gespeichert.', en: 'No notes saved yet.' },

    // Cancellation
    cancelMembership: { de: 'Mitgliedschaft kündigen', en: 'Cancel membership' },
    cancelDisclaimer: { de: 'Eine Kündigung muss vom Gym bestätigt werden. Deine Mitgliedschaft läuft bis zur Bearbeitung weiter.', en: 'Cancellation must be confirmed by the gym. Your membership continues until processed.' },
    cancellationRequested: { de: 'Kündigung angefordert', en: 'Cancellation requested' },
    cancellationDate: { de: 'Eingereicht am {date}. Dein Gym wird sich melden.', en: 'Submitted on {date}. Your gym will get back to you.' },
    withdrawCancellation: { de: 'Kündigung zurückziehen', en: 'Withdraw cancellation' },
    reasonOptional: { de: 'Grund (optional)…', en: 'Reason (optional)…' },
    sendCancellation: { de: 'Kündigung senden', en: 'Send cancellation' },
    sending:          { de: 'Wird gesendet…', en: 'Sending…' },
    requestCancellation: { de: 'Kündigung anfordern', en: 'Request cancellation' },

    // Contract
    contractExpired: { de: 'Vertrag abgelaufen', en: 'Contract expired' },
    contractExpiring: { de: 'Vertrag läuft in {n} {unit} ab', en: 'Contract expires in {n} {unit}' },
    day:     { de: 'Tag',    en: 'day' },
    days:    { de: 'Tagen',  en: 'days' },
    contractValid: { de: 'Vertrag gültig bis {date}', en: 'Contract valid until {date}' },

    // PWA
    installApp: { de: '{gym} App installieren', en: 'Install {gym} App' },
    addToHomescreen: { de: 'App zum Homescreen hinzufügen', en: 'Add App to Home Screen' },
    iosStep1: { de: 'Tippe auf das Teilen-Symbol unten in der Browserleiste', en: 'Tap the Share icon at the bottom of the browser bar' },
    iosStep2: { de: 'Scrolle nach unten und tippe auf „Zum Home-Bildschirm"', en: 'Scroll down and tap "Add to Home Screen"' },
    iosStep3: { de: 'Tippe oben rechts auf „Hinzufügen"', en: 'Tap "Add" in the top right' },
    understood: { de: 'Verstanden', en: 'Got it' },

    // Misc
    poweredBy: { de: 'Powered by', en: 'Powered by' },
    newsFromGym: { de: 'News vom Gym', en: 'News from the gym' },
  },

  // ── Payment statuses ─────────────────────────────────────────────────────────
  paymentStatus: {
    paid:     { de: 'Bezahlt',        en: 'Paid' },
    pending:  { de: 'Ausstehend',     en: 'Pending' },
    failed:   { de: 'Fehlgeschlagen', en: 'Failed' },
    refunded: { de: 'Erstattet',      en: 'Refunded' },
  },

  // ── Class types ──────────────────────────────────────────────────────────────
  classType: {
    gi:          { de: 'Gi',          en: 'Gi' },
    'no-gi':     { de: 'No-Gi',       en: 'No-Gi' },
    'open mat':  { de: 'Open Mat',    en: 'Open Mat' },
    kids:        { de: 'Kids',        en: 'Kids' },
    competition: { de: 'Competition', en: 'Competition' },
    'muay-thai': { de: 'Muay Thai',   en: 'Muay Thai' },
    kickboxen:   { de: 'Kickboxen',   en: 'Kickboxing' },
    fitness:     { de: 'Fitness',     en: 'Fitness' },
    yoga:        { de: 'Yoga',        en: 'Yoga' },
  },

  // ── Landing page ─────────────────────────────────────────────────────────────
  landing: {
    hero: {
      badge:    { de: 'Für Kampfsport-Gyms', en: 'For martial arts gyms' },
      headline: { de: 'Dein Gym. Einfach digital.', en: 'Your gym. Simply digital.' },
      sub:      { de: 'Mitglieder, Stundenpläne, Zahlungen und Check-ins — alles in einer Plattform.', en: 'Members, schedules, payments, and check-ins — all in one platform.' },
      cta:      { de: 'Kostenlos starten', en: 'Start for free' },
      demo:     { de: 'Demo ansehen', en: 'Watch demo' },
    },
    nav: {
      features: { de: 'Features', en: 'Features' },
      pricing:  { de: 'Preise',   en: 'Pricing' },
      login:    { de: 'Anmelden', en: 'Log in' },
      start:    { de: 'Starten',  en: 'Get started' },
    },
    features: {
      headline: { de: 'Alles was dein Gym braucht', en: 'Everything your gym needs' },
      members:  { de: 'Mitgliederverwaltung', en: 'Member management' },
      schedule: { de: 'Stundenplan',           en: 'Schedule' },
      payments: { de: 'Zahlungen',             en: 'Payments' },
      checkin:  { de: 'Check-in',              en: 'Check-in' },
      portal:   { de: 'Mitglieder-Portal',     en: 'Member portal' },
    },
    pricing: {
      headline: { de: 'Einfache Preise', en: 'Simple pricing' },
      free:     { de: 'Kostenlos',       en: 'Free' },
      perMonth: { de: '/Monat',          en: '/month' },
    },
    footer: {
      imprint:  { de: 'Impressum',  en: 'Imprint' },
      privacy:  { de: 'Datenschutz', en: 'Privacy' },
      terms:    { de: 'AGB',        en: 'Terms' },
    },
  },
} as const

export type TranslationKey = typeof translations
