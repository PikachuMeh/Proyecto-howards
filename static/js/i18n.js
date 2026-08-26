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
        name_hint: "Between 2 and 40 characters. No account needed!",
        start_button: "Begin Sorting Ceremony",
        err_name_required: "Please enter your name (2–40 characters).",
        err_invalid_name_chars: "Wizard names can only contain letters, spaces, hyphens, and apostrophes (no numbers or symbols).",
        err_duplicate_name: "This name is already registered for this event. Please choose another.",
        
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
        
        // Public Screen
        screen_title: "Hogwarts Sorting Ceremony",
        waiting_for_wizards: "Awaiting new students to step forward...",
        house_members_count: "{count} students",
        recent_sorted: "Recently Sorted",
        hesitant_text: "Hmm... a difficult choice between two great houses...",
        connected: "Live",
        reconnecting: "Reconnecting...",
        
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
        filter_all: "All Houses",
        filter_gryffindor: "🦁 Gryffindor",
        filter_ravenclaw: "🦅 Ravenclaw",
        filter_hufflepuff: "🦡 Hufflepuff",
        filter_slytherin: "🐍 Slytherin",
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
        err_connection: "Connection error. Please check your network."
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
        name_hint: "Zwischen 2 und 40 Zeichen. Keine Registrierung nötig!",
        start_button: "Auswahlzeremonie beginnen",
        err_name_required: "Bitte gib deinen Namen ein (2–40 Zeichen).",
        err_invalid_name_chars: "Zauberernamen dürfen nur Buchstaben, Leerzeichen, Bindestriche und Apostrophe enthalten (keine Zahlen oder Symbole).",
        err_duplicate_name: "Dieser Name ist für diese Feier bereits vergeben. Bitte wähle einen anderen.",
        
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
        
        // Public Screen
        screen_title: "Hogwarts Auswahlzeremonie",
        waiting_for_wizards: "Warten auf neue Zauberschüler...",
        house_members_count: "{count} Schüler",
        recent_sorted: "Kürzlich zugeteilt",
        hesitant_text: "Hmm... eine schwere Entscheidung zwischen zwei großen Häusern...",
        connected: "Live",
        reconnecting: "Verbindung wird wiederhergestellt...",
        
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
        filter_all: "Alle Häuser",
        filter_gryffindor: "🦁 Gryffindor",
        filter_ravenclaw: "🦅 Ravenclaw",
        filter_hufflepuff: "🦡 Hufflepuff",
        filter_slytherin: "🐍 Slytherin",
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
        err_connection: "Verbindungsfehler. Bitte überprüfe deine Verbindung."
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
