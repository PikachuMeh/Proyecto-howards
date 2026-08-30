// Bilingual dictionary for English and German
const translations = {
    en: {
        // App / Brand
        app_title: "Hogwarts Sorting Hat",
        hogwarts_party: "Hogwarts Christmas Party",
        subtitle_guest: "Discover which house you truly belong to",
        tagline: "The Sorting Ceremony is about to begin...",
        
        // Guest - Registration
        enter_name_label: "What is your wizarding or witch name?",
        name_placeholder: "e.g., Albus Dumbledore",
        name_hint: "Between 2 and 40 characters (letters, hyphens, spaces).",
        enter_password_label: "Secret Spell (Password)",
        password_placeholder: "Enter secret spell (password)...",
        password_hint: "Used to identify your score in the House Cup!",
        start_button: "Begin Sorting Ceremony",
        err_name_required: "Please enter your name (2–40 characters).",
        err_password_required: "Please enter a secret spell (at least 3 characters).",
        err_invalid_name_chars: "Wizard names can only contain letters, spaces, hyphens, and apostrophes (no numbers or symbols).",
        err_duplicate_name: "This name is already registered for this event. Please enter the correct password or choose another name.",
        
        // Guest - Questionnaire
        question_counter: "Question {current} of {total}",
        btn_prev: "← Previous",
        btn_next: "Next →",
        btn_decide: "✨ Let the Hat decide! ✨",
        select_an_option: "Please select an answer to continue.",
        
        // Guest - Waiting & Result
        sorting_in_progress: "The Sorting Hat is deliberating...",
        sorting_hint: "Hmm... difficult. Very difficult. Plenty of courage, I see. Not a bad mind either...",
        you_belong_to: "You have been sorted into...",
        motto_title: "House Motto",
        score_breakdown: "Score Breakdown",
        already_sorted_title: "You are already sorted!",
        already_sorted_msg: "Each guest participates in the ceremony once.",
        btn_view_screen: "View Public Projection Screen",
        btn_house_games: "🏆 House Games",
        btn_play_house_games: "🏆 Play House Games (+1-2 pts)",
        btn_sort_another: "🧙 Sort Another Wizard",
        modal_games_title: "🏆 Hogwarts House Games",
        lbl_total_house_points: "Total House Cup Points:",
        house_games_desc: "Cast your magical spell to win points for your House Cup! Each attempt awards 1 to 2 random points.",
        btn_cast_spell: "🎲 Cast Magical Spell (+1-2 pts) ✨",
        btn_max_spells_reached: "🔒 Max Spells Cast (2/2)",
        btn_cast_spell_count: "🎲 Cast Magical Spell ({used}/2) ✨",
        lbl_spells_cast_badge: "✨ Spells Cast: {count}/2",
        login_games_title: "House Games Login",
        login_games_subtitle: "Enter your Wizard Name and Secret Spell to access your house:",
        btn_login_games: "Log In to House Games",
        msg_points_won: "✨ Excellent! You earned +{pts} points for {house}! 🏆",
        err_not_sorted_for_games: "You must complete the Sorting Ceremony first to join a House!",
        
        // Public Screen
        screen_title: "Hogwarts Sorting Ceremony",
        waiting_for_wizards: "Awaiting new students to step forward...",
        house_members_count: "{count} students",
        recent_sorted: "Recently Sorted",
        hesitant_text: "Hmm... a difficult choice between two great houses...",
        connected: "Live",
        reconnecting: "Reconnecting...",
        total_overview: "OVERVIEW",
        lbl_total_registered: "TOTAL",
        members_label: "MEMBERS",
        latest_member: "LATEST MEMBER",
        moderator_controls: "CONTROLS",
        btn_fullscreen: "FULLSCREEN",
        new_member_sorting: "A NEW STUDENT IS BEING SORTED...",
        
        // Admin
        admin_title: "Sorting Hat — Headmaster Control Panel",
        login_header: "Restricted Access: Headmasters Only",
        username_label: "Administrator Username",
        username_placeholder: "e.g., admin or dumbledore",
        password_label: "Secret Spell (Password)",
        password_placeholder: "Enter secret spell (password)...",
        btn_login: "Alohomora (Log In)",
        logout: "Log Out",
        logged_in_as: "Logged in as",
        stat_total_participants: "Total Registered",
        stat_total_assigned: "Sorted Students",
        stat_balancing_mode: "House Balancing Mode",
        stat_balancing_desc: "Penalizes saturated houses to keep house sizes even (FR-18)",
        btn_reset_event: "Reset Event",
        btn_auto_balance: "Auto-Balance Houses",
        confirm_auto_balance: "Do you want to automatically redistribute participants evenly across all 4 houses based on their quiz preferences?",
        btn_export_csv: "Export CSV",
        btn_show_qr: "Display QR Code",
        btn_closing_stats: "Closing Statistics",
        participants_table_title: "Participant Roster",
        search_placeholder: "Search by name...",
        role_headmaster: "Headmaster",
        role_deputy_headmistress: "Deputy Headmistress",
        role_deputy_headmaster: "Deputy Headmaster",
        badge_manual: "Manual",
        no_participants_found: "No participants found matching current filters.",
        filter_all: "All Houses",
        filter_gryffindor: "Gryffindor",
        filter_ravenclaw: "Ravenclaw",
        filter_hufflepuff: "Hufflepuff",
        filter_slytherin: "Slytherin",
        col_id: "ID",
        col_name: "Name",
        col_language: "Language",
        col_house: "House",
        col_score: "Score",
        col_assigned_at: "Assigned At",
        col_actions: "Actions",
        btn_reassign: "Reassign",
        btn_delete: "Delete",
        not_sorted_yet: "In Progress",
        confirm_reset: "Are you sure you want to delete all participants and assignments? This cannot be undone.",
        confirm_delete: "Are you sure you want to delete this participant?",
        reassign_modal_title: "Manually Reassign House",
        btn_save: "Save",
        btn_cancel: "Cancel",
        scan_to_join: "Scan to Join the Sorting Ceremony",
        err_invalid_credentials: "Invalid username or secret spell (password).",
        err_connection: "Connection error. Please check your network.",
        tab_roster: "Participant Roster",
        tab_questions: "Question Manager",
        questions_manager_title: "Sorting Questions & Scoring",
        btn_add_question: "➕ Add New Question",
        modal_add_question_title: "Add New Question",
        modal_edit_question_title: "Edit Question",
        lbl_question_en: "Question Text (English)",
        lbl_question_de: "Question Text (German)",
        lbl_options_and_scores: "Options & House Points (0 to 10 max):",
        btn_save_question: "Save Question",
        btn_edit: "Edit",
        btn_delete: "Delete",
        confirm_delete_question: "Are you sure you want to delete this question? Associated answers will also be removed.",
        msg_question_saved: "Question saved successfully!",
        msg_question_deleted: "Question deleted successfully!",
        err_question_validation: "Please fill in all question texts and option fields.",
        err_score_limit: "Points per house must be between 0 and 10.",
        question_badge: "Question",
        col_house_points: "House Cup Pts",
        btn_edit_points: "Edit Pts",
        modal_edit_points_title: "Edit Participant Points",
        lbl_house_game_points: "House Cup Points (Spells & Games)",
        lbl_sorting_score: "Sorting Quiz Score",
        lbl_spells_cast_count: "Spells Cast Attempts (0 to 2)",
        msg_points_updated: "Participant points updated successfully!",

        // Student Profile Modal & Daily Prophet (Admin)
        lbl_profile_cup_pts: "🏆 House Cup Pts",
        lbl_profile_spells: "🔮 Spells",
        lbl_profile_spells_cast_val: "{count} / 2 cast",
        lbl_profile_quiz: "📜 Quiz Score",
        lbl_profile_lang: "🌐 Language",
        lbl_profile_assigned_date: "📅 Assigned At:",
        lbl_profile_not_assigned: "Sorting pending",
        prophet_badge_title: "📰 THE DAILY PROPHET • EMBLEMATIC WIZARD",
        btn_edit_points_full: "✏️ Edit Points",
        btn_reassign_house_full: "🏰 Reassign House",
        btn_delete_full: "🗑️ Delete Wizard",
        btn_view_profile: "🔍 Profile",

        // Daily Prophet Sorting Announcement (Screen)
        prophet_headline_breaking: "EXTRA: NEW WIZARD SORTED INTO HOGWARTS!",
        prophet_welcome_caption: "{name} welcomes the new student.",
        prophet_article_intro: "Great Hall — Before the solemn gaze of the faculty and the four founder banners:",
        prophet_destiny_label: "HAS BEEN SORTED INTO THE HOUSE:",
        prophet_footer_note: "⚡ SORTING HAT • HOGWARTS SCHOOL OF WITCHCRAFT & WIZARDRY ⚡",
        sorting_decree: "THE SORTING HAT HAS DECIDED...",

        // Admin Dashboard Short Labels
        stat_registered: "Registered",
        stat_sorted: "Sorted",
        stat_balancing: "Balancing",
        stat_balancing_desc_short: "Even distribution across all 4 houses",
        tab_students: "Students",
        tab_questions_short: "Questions",
        btn_qr_code: "📲 QR Code",
        btn_export_csv: "📊 Export CSV",
        btn_statistics: "🏆 Statistics",
        btn_auto_balance_short: "⚖️ Auto-Balance",
        btn_reset_short: "⭮ Reset",
        table_registered_students: "Registered Students",
        filter_all_houses: "All Houses",
        search_name_placeholder: "Search by name...",
        th_id: "ID",
        th_wizard: "Wizard / Witch",
        th_house: "House",
        th_cup_points: "Cup Points",
        th_spells: "Spells",
        th_actions: "Actions"
    },
    de: {
        // App / Brand
        app_title: "Hogwarts Sprechender Hut",
        hogwarts_party: "Hogwarts Weihnachtsfeier",
        subtitle_guest: "Finde heraus, in welches Haus du wahrhaftig gehörst",
        tagline: "Die Auswahlzeremonie beginnt in Kürze...",
        
        // Guest - Registration
        enter_name_label: "Wie lautet dein Zauberer- oder Hexenname?",
        name_placeholder: "z.B. Albus Dumbledore",
        name_hint: "Zwischen 2 und 40 Zeichen (Buchstaben, Bindestriche, Leerzeichen).",
        enter_password_label: "Geheimzauber (Passwort)",
        password_placeholder: "Geheimzauber eingeben (Passwort)...",
        password_hint: "Wird genutzt, um deine Punkte im Hauspokal zuzuordnen!",
        start_button: "Auswahlzeremonie beginnen",
        err_name_required: "Bitte gib deinen Namen ein (2–40 Zeichen).",
        err_password_required: "Bitte gib einen Geheimzauber ein (mindestens 3 Zeichen).",
        err_invalid_name_chars: "Zauberernamen dürfen nur Buchstaben, Leerzeichen, Bindestriche und Apostrophe enthalten (keine Zahlen oder Symbole).",
        err_duplicate_name: "Dieser Name ist für diese Feier bereits vergeben. Bitte gib das richtige Passwort ein oder wähle einen anderen Namen.",
        
        // Guest - Questionnaire
        question_counter: "Frage {current} von {total}",
        btn_prev: "← Zurück",
        btn_next: "Weiter →",
        btn_decide: "✨ Lass den Hut entscheiden! ✨",
        select_an_option: "Bitte wähle eine Antwort aus, um fortzufahren.",
        
        // Guest - Waiting & Result
        sorting_in_progress: "Der sprechende Hut überlegt...",
        sorting_hint: "Hmm... schwierig. Sehr schwierig. Viel Mut, wie ich sehe. Kein schlechter Verstand...",
        you_belong_to: "Du wurdest eingeteilt in...",
        motto_title: "Hausmotto",
        score_breakdown: "Punkteübersicht",
        already_sorted_title: "Du wurdest bereits zugeteilt!",
        already_sorted_msg: "Jeder Gast nimmt genau einmal an der Zeremonie teil.",
        btn_view_screen: "Zur öffentlichen Projektion",
        btn_house_games: "🏆 Hausspiele",
        btn_play_house_games: "🏆 Hausspiele spielen (+1-2 Pkt)",
        btn_sort_another: "🧙 Weiteren Schüler einteilen",
        modal_games_title: "🏆 Hogwarts Hausspiele",
        lbl_total_house_points: "Gesamte Hauspokal-Punkte:",
        house_games_desc: "Wirke deinen Zauberspruch, um Punkte für deinen Hauspokal zu gewinnen! Jeder Versuch bringt 1 bis 2 Punkte.",
        btn_cast_spell: "🎲 Zauberspruch wirken (+1-2 Pkt) ✨",
        btn_max_spells_reached: "🔒 Max. Zauber gewirkt (2/2)",
        btn_cast_spell_count: "🎲 Zauberspruch wirken ({used}/2) ✨",
        lbl_spells_cast_badge: "✨ Gewirkte Zauber: {count}/2",
        login_games_title: "Hausspiele Anmeldung",
        login_games_subtitle: "Gib deinen Zauberernamen und Geheimzauber ein, um auf dein Haus zuzugreifen:",
        btn_login_games: "Bei den Hausspielen anmelden",
        msg_points_won: "✨ Großartig! Du hast +{pts} Punkte für {house} geholt! 🏆",
        err_not_sorted_for_games: "Du musst zuerst an der Auswahlzeremonie teilnehmen!",
        
        // Public Screen
        screen_title: "Hogwarts Auswahlzeremonie",
        waiting_for_wizards: "Warten auf neue Zauberschüler...",
        house_members_count: "{count} Schüler",
        recent_sorted: "Kürzlich zugeteilt",
        hesitant_text: "Hmm... eine schwere Entscheidung zwischen zwei großen Häusern...",
        connected: "Live",
        reconnecting: "Verbindung wird wiederhergestellt...",
        total_overview: "ÜBERSICHT",
        lbl_total_registered: "GESAMT",
        members_label: "MITGLIEDER",
        latest_member: "LETZTER SCHÜLER",
        moderator_controls: "STEUERUNG",
        btn_fullscreen: "VOLLBILD",
        new_member_sorting: "EIN NEUES MITGLIED WIRD SORTIERT...",
        
        // Admin
        admin_title: "Sprechender Hut — Schulleiter Kontrollzentrum",
        login_header: "Geschützter Bereich: Nur für Schulleiter",
        username_label: "Administrator Benutzername",
        username_placeholder: "z.B. admin oder dumbledore",
        password_label: "Geheimzauber (Passwort)",
        password_placeholder: "Geheimzauber eingeben (Passwort)...",
        btn_login: "Alohomora (Anmelden)",
        logout: "Abmelden",
        logged_in_as: "Angemeldet als",
        stat_total_participants: "Registrierte Gäste",
        stat_total_assigned: "Zugeordnete Schüler",
        stat_balancing_mode: "Haus-Ausgleichsmodus",
        stat_balancing_desc: "Verhindert ein extremes Ungleichgewicht zwischen den Häusern (FR-18)",
        btn_reset_event: "Feier zurücksetzen",
        btn_auto_balance: "Häuser ausgleichen",
        confirm_auto_balance: "Möchtest du die Teilnehmer automatisch gleichmäßig auf alle 4 Häuser verteilen?",
        btn_export_csv: "CSV exportieren",
        btn_show_qr: "QR-Code anzeigen",
        btn_closing_stats: "Abschluss-Statistiken",
        participants_table_title: "Teilnehmerliste",
        search_placeholder: "Nach Name suchen...",
        role_headmaster: "Schulleiter",
        role_deputy_headmistress: "Stellv. Schulleiterin",
        role_deputy_headmaster: "Stellv. Schulleiter",
        badge_manual: "Manuell",
        no_participants_found: "Keine Teilnehmer gefunden, die den Filtern entsprechen.",
        filter_all: "Alle Häuser",
        filter_gryffindor: "Gryffindor",
        filter_ravenclaw: "Ravenclaw",
        filter_hufflepuff: "Hufflepuff",
        filter_slytherin: "Slytherin",
        col_id: "ID",
        col_name: "Name",
        col_language: "Sprache",
        col_house: "Haus",
        col_score: "Punkte",
        col_assigned_at: "Zugeordnet am",
        col_actions: "Aktionen",
        btn_reassign: "Umteilen",
        btn_delete: "Löschen",
        not_sorted_yet: "In Bearbeitung",
        confirm_reset: "Möchtest du wirklich alle Teilnehmer und Zuteilungen löschen? Dies kann nicht rückgängig gemacht werden.",
        confirm_delete: "Möchtest du diesen Teilnehmer wirklich löschen?",
        reassign_modal_title: "Haus manuell zuweisen",
        btn_save: "Speichern",
        btn_cancel: "Abbrechen",
        scan_to_join: "Scannen, um an der Zeremonie teilzunehmen",
        err_invalid_credentials: "Ungültiger Benutzername oder Geheimzauber (Passwort).",
        err_connection: "Verbindungsfehler. Bitte überprüfe deine Verbindung.",
        tab_roster: "Teilnehmerliste",
        tab_questions: "Fragen-Verwaltung",
        questions_manager_title: "Auswahlfragen & Punkteverteilung",
        btn_add_question: "➕ Neue Frage hinzufügen",
        modal_add_question_title: "Neue Frage hinzufügen",
        modal_edit_question_title: "Frage bearbeiten",
        lbl_question_en: "Fragentext (Englisch)",
        lbl_question_de: "Fragentext (Deutsch)",
        lbl_options_and_scores: "Optionen & Haus-Punkte (0 bis max. 10):",
        btn_save_question: "Frage speichern",
        btn_edit: "Bearbeiten",
        confirm_delete_question: "Möchtest du diese Frage wirklich löschen? Zugehörige Antworten werden ebenfalls entfernt.",
        msg_question_saved: "Frage erfolgreich gespeichert!",
        msg_question_deleted: "Frage erfolgreich gelöscht!",
        err_question_validation: "Bitte fülle alle Fragentexte und Optionen aus.",
        err_score_limit: "Punkte pro Haus müssen zwischen 0 und 10 liegen.",
        question_badge: "Frage",
        col_house_points: "Hauspokal-Pkte",
        btn_edit_points: "Punkte bearbeiten",
        modal_edit_points_title: "Teilnehmer-Punkte bearbeiten",
        lbl_house_game_points: "Hauspokal-Punkte (Zauber & Spiele)",
        lbl_sorting_score: "Auswahl-Quiz-Punkte",
        lbl_spells_cast_count: "Zauberversuche (0 bis 2)",
        msg_points_updated: "Teilnehmer-Punkte erfolgreich aktualisiert!",

        // Student Profile Modal & Daily Prophet (Admin)
        lbl_profile_cup_pts: "🏆 Hauspokal-Pkte",
        lbl_profile_spells: "🔮 Zaubersprüche",
        lbl_profile_spells_cast_val: "{count} / 2 gewirkt",
        lbl_profile_quiz: "📜 Quiz-Punkte",
        lbl_profile_lang: "🌐 Sprache",
        lbl_profile_assigned_date: "📅 Zugeordnet am:",
        lbl_profile_not_assigned: "Zuteilung ausstehend",
        prophet_badge_title: "📰 DER TAGESPROPHET • EMBLEMATISCHER ZAUBERER",
        btn_edit_points_full: "✏️ Punkte bearbeiten",
        btn_reassign_house_full: "🏰 Haus ändern",
        btn_delete_full: "🗑️ Löschen",
        btn_view_profile: "🔍 Profil",

        // Daily Prophet Sorting Announcement (Screen)
        prophet_headline_breaking: "EXTRA: EIN NEUER ZAUBERER IN HOGWARTS EINGETEILT!",
        prophet_welcome_caption: "{name} heißt den neuen Schüler willkommen.",
        prophet_article_intro: "Große Halle — Vor den feierlichen Blicken des Lehrerkollegiums und der vier Gründerbanner:",
        prophet_destiny_label: "WURDE DEM HAUS ZUGETEILT:",
        prophet_footer_note: "⚡ DER SPRECHENDE HUT • HOGWARTS-SCHULE FÜR HEXEREI UND ZAUBEREI ⚡",
        sorting_decree: "DER SPRECHENDE HUT HAT ENTSCHIEDEN...",

        // Admin Dashboard Short Labels
        stat_registered: "Registriert",
        stat_sorted: "Zugeordnet",
        stat_balancing: "Ausgleich",
        stat_balancing_desc_short: "Gleichmäßige Verteilung auf alle 4 Häuser",
        tab_students: "Schüler",
        tab_questions_short: "Fragen",
        btn_qr_code: "📲 QR-Code",
        btn_export_csv: "📊 CSV Export",
        btn_statistics: "🏆 Statistiken",
        btn_auto_balance_short: "⚖️ Ausgleichen",
        btn_reset_short: "⭮ Zurücksetzen",
        table_registered_students: "Registrierte Schüler",
        filter_all_houses: "Alle Häuser",
        search_name_placeholder: "Nach Name suchen...",
        th_id: "ID",
        th_wizard: "Zauberer / Hexe",
        th_house: "Haus",
        th_cup_points: "Hauspokal-Pkte",
        th_spells: "Zauber",
        th_actions: "Aktionen"
    }
};

class I18nManager {
    constructor() {
        this.currentLang = localStorage.getItem("sorting_lang") || "en";
    }

    getLang() {
        return this.currentLang;
    }

    setLang(lang) {
        if (lang === "en" || lang === "de") {
            this.currentLang = lang;
            localStorage.setItem("sorting_lang", lang);
            this.applyTranslations();
            // Dispatch event for custom listeners
            window.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
        }
    }

    t(key, params = {}) {
        let text = (translations[this.currentLang] && translations[this.currentLang][key]) ||
                   (translations["en"] && translations["en"][key]) || key;
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(`{${k}}`, v);
        }
        return text;
    }

    applyTranslations() {
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            el.textContent = this.t(key);
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            el.placeholder = this.t(key);
        });

        // Update active class on language toggle buttons
        document.querySelectorAll(".lang-btn").forEach(btn => {
            if (btn.getAttribute("data-lang") === this.currentLang) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }
}

const i18n = new I18nManager();
window.i18n = i18n;

document.addEventListener("DOMContentLoaded", () => {
    i18n.applyTranslations();
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const lang = e.currentTarget.getAttribute("data-lang");
            i18n.setLang(lang);
        });
    });
});
