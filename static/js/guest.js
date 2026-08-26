// Guest Questionnaire Logic

class GuestApp {
    constructor() {
        this.currentStep = "step-register";
        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswers = {}; // { question_id: option_id }
        this.sessionToken = null;
        this.participant = null;
        this.assignment = null;

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.checkSession();
    }

    bindEvents() {
        // Registration form submit
        const form = document.getElementById("form-register");
        if (form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // Navigation buttons
        document.getElementById("btn-prev").addEventListener("click", () => this.handlePrev());
        document.getElementById("btn-next").addEventListener("click", () => this.handleNext());
        document.getElementById("btn-submit-sorting").addEventListener("click", () => this.handleFinalSubmit());
        document.getElementById("btn-toggle-breakdown").addEventListener("click", () => {
            const box = document.getElementById("score-breakdown-container");
            box.classList.toggle("hidden");
        });

        // Language change event listener
        window.addEventListener("langchange", async (e) => {
            if (this.questions.length > 0) {
                await this.loadQuestions();
                this.renderCurrentQuestion();
            }
            if (this.assignment) {
                await this.fetchMyAssignment();
            }
        });
    }

    showStep(stepId) {
        document.querySelectorAll(".guest-step").forEach(el => el.classList.remove("active"));
        const target = document.getElementById(stepId);
        if (target) {
            target.classList.add("active");
            this.currentStep = stepId;
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    showError(elementId, message) {
        const errEl = document.getElementById(elementId);
        if (errEl) {
            errEl.textContent = message;
            errEl.classList.remove("hidden");
        }
    }

    clearError(elementId) {
        const errEl = document.getElementById(elementId);
        if (errEl) {
            errEl.classList.add("hidden");
            errEl.textContent = "";
        }
    }

    async checkSession() {
        try {
            const res = await fetch("/api/me");
            if (res.ok) {
                const data = await res.json();
                this.participant = data;
                this.sessionToken = data.session_token;

                if (data.has_assignment) {
                    // Already sorted!
                    await this.fetchMyAssignment();
                } else {
                    // Resume questionnaire
                    await this.loadQuestions();
                    await this.loadSavedAnswers();
                    this.showStep("step-questionnaire");
                }
            } else {
                this.showStep("step-register");
            }
        } catch (e) {
            this.showStep("step-register");
        }
    }

    async handleRegister() {
        const nameInput = document.getElementById("display-name");
        const name = nameInput.value.trim();
        this.clearError("register-error");

        if (name.length < 2 || name.length > 40) {
            this.showError("register-error", window.i18n.t("err_name_required"));
            return;
        }

        // Validate characters: only letters (including accents), spaces, hyphens, and apostrophes allowed (no numbers or symbols)
        const nameRegex = /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'\-]+$/;
        const letterCount = (name.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g) || []).length;
        if (!nameRegex.test(name) || letterCount < 2) {
            this.showError("register-error", window.i18n.t("err_invalid_name_chars"));
            return;
        }

        const btn = document.getElementById("btn-start");
        btn.disabled = true;

        try {
            const lang = window.i18n.getLang();
            const res = await fetch("/api/participants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ display_name: name, preferred_lang: lang })
            });

            const data = await res.json();
            if (res.status === 201) {
                this.participant = data;
                this.sessionToken = data.session_token;
                await this.loadQuestions();
                this.showStep("step-questionnaire");
            } else {
                let msg = data.detail || "Registration failed";
                if (res.status === 400 && typeof data.detail === "string" && data.detail.includes("already registered")) {
                    msg = window.i18n.t("err_duplicate_name");
                } else if (res.status === 422 || (typeof data.detail === "string" && data.detail.includes("letters"))) {
                    msg = window.i18n.t("err_invalid_name_chars");
                }
                this.showError("register-error", msg);
            }
        } catch (err) {
            this.showError("register-error", "Network connection error. Please try again.");
        } finally {
            btn.disabled = false;
        }
    }

    async loadQuestions() {
        const lang = window.i18n.getLang();
        const res = await fetch(`/api/questions?lang=${lang}`);
        if (res.ok) {
            this.questions = await res.json();
            this.renderCurrentQuestion();
        }
    }

    async loadSavedAnswers() {
        try {
            const res = await fetch("/api/answers");
            if (res.ok) {
                this.selectedAnswers = await res.json();
                // Find first unanswered question
                for (let i = 0; i < this.questions.length; i++) {
                    if (!this.selectedAnswers[this.questions[i].id]) {
                        this.currentIndex = i;
                        break;
                    }
                }
                this.renderCurrentQuestion();
            }
        } catch (e) {
            console.error("Error loading answers", e);
        }
    }

    renderCurrentQuestion() {
        if (!this.questions || this.questions.length === 0) return;
        const q = this.questions[this.currentIndex];
        if (!q) return;

        // Progress bar
        const total = this.questions.length;
        const current = this.currentIndex + 1;
        document.getElementById("question-progress-text").textContent = 
            window.i18n.t("question_counter", { current, total });

        const pct = (current / total) * 100;
        document.getElementById("progress-bar-fill").style.width = `${pct}%`;

        // Title
        document.getElementById("question-title").textContent = q.text;

        // Options
        const container = document.getElementById("options-list");
        container.innerHTML = "";
        const markers = ["A", "B", "C", "D"];

        q.options.forEach((opt, idx) => {
            const card = document.createElement("div");
            card.className = "option-card";
            if (this.selectedAnswers[q.id] === opt.id) {
                card.classList.add("selected");
            }

            card.innerHTML = `
                <div class="option-marker">${markers[idx] || (idx + 1)}</div>
                <div class="option-text">${opt.text}</div>
            `;

            card.addEventListener("click", () => {
                this.selectOption(q.id, opt.id);
            });

            container.appendChild(card);
        });

        // Navigation button states
        const prevBtn = document.getElementById("btn-prev");
        const nextBtn = document.getElementById("btn-next");
        const submitBtn = document.getElementById("btn-submit-sorting");

        prevBtn.disabled = this.currentIndex === 0;
        if (this.currentIndex === total - 1) {
            nextBtn.classList.add("hidden");
            submitBtn.classList.remove("hidden");
        } else {
            nextBtn.classList.remove("hidden");
            submitBtn.classList.add("hidden");
        }
    }

    async selectOption(questionId, optionId) {
        this.selectedAnswers[questionId] = optionId;
        this.clearError("quiz-error");
        this.renderCurrentQuestion();

        // Save answer to backend
        try {
            await fetch("/api/answers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question_id: questionId, option_id: optionId })
            });
        } catch (e) {
            console.error("Failed to save answer", e);
        }
    }

    handlePrev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.clearError("quiz-error");
            this.renderCurrentQuestion();
        }
    }

    handleNext() {
        const q = this.questions[this.currentIndex];
        if (!this.selectedAnswers[q.id]) {
            this.showError("quiz-error", window.i18n.t("select_an_option"));
            return;
        }
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.clearError("quiz-error");
            this.renderCurrentQuestion();
        }
    }

    async handleFinalSubmit() {
        const q = this.questions[this.currentIndex];
        if (!this.selectedAnswers[q.id]) {
            this.showError("quiz-error", window.i18n.t("select_an_option"));
            return;
        }

        // Switch to deliberation suspense animation
        this.showStep("step-deliberation");
        this.playMagicalHum();

        try {
            const lang = window.i18n.getLang();
            const res = await fetch(`/api/assignments?lang=${lang}`, {
                method: "POST"
            });

            if (res.status === 201) {
                const result = await res.json();
                this.assignment = result;
                // Add dramatic suspense pause of 1.5s
                setTimeout(() => {
                    this.renderResult(result);
                }, 1600);
            } else {
                const data = await res.json().catch(() => ({}));
                console.error("Sorting error", data);
                this.showStep("step-questionnaire");
            }
        } catch (err) {
            console.error("Error connecting to server", err);
            this.showStep("step-questionnaire");
        }
    }

    async fetchMyAssignment() {
        const lang = window.i18n.getLang();
        const res = await fetch(`/api/my-assignment?lang=${lang}`);
        if (res.ok) {
            const data = await res.json();
            this.assignment = data;
            this.renderResult(data);
        }
    }

    renderResult(assignment) {
        this.showStep("step-result");
        this.playFanfare();

        const card = document.getElementById("result-card");
        const title = document.getElementById("result-house-name");
        const motto = document.getElementById("result-house-motto");
        const crest = document.getElementById("house-crest-icon");

        const houseTheme = {
            "GRY": { text: "#fca5a5", glow: "rgba(239, 68, 68, 0.7)", border: "#ef4444", bg: "rgba(116, 0, 1, 0.35)", bar: "#ef4444" },
            "RAV": { text: "#93c5fd", glow: "rgba(59, 130, 246, 0.7)", border: "#3b82f6", bg: "rgba(14, 26, 64, 0.5)", bar: "#3b82f6" },
            "HUF": { text: "#fde047", glow: "rgba(234, 179, 8, 0.7)", border: "#eab308", bg: "rgba(236, 185, 57, 0.3)", bar: "#eab308" },
            "SLY": { text: "#86efac", glow: "rgba(34, 197, 94, 0.7)", border: "#22c55e", bg: "rgba(26, 71, 42, 0.4)", bar: "#22c55e" }
        };

        const theme = houseTheme[assignment.house_code] || {
            text: "#f5c518", glow: "rgba(245, 197, 24, 0.6)", border: "#d3a625", bg: "rgba(22, 27, 46, 0.95)", bar: "#f5c518"
        };

        title.textContent = assignment.house_name;
        title.style.color = theme.text;
        title.style.textShadow = `0 0 25px ${theme.glow}, 0 2px 6px rgba(0,0,0,0.9)`;
        motto.textContent = `"${assignment.motto}"`;
        
        // Crest icon mapping
        const icons = {
            "GRY": "🦁",
            "RAV": "🦅",
            "HUF": "🦡",
            "SLY": "🐍"
        };
        crest.textContent = icons[assignment.house_code] || "✨";

        // House color aura & background
        card.style.borderColor = theme.border;
        card.style.boxShadow = `0 0 35px ${theme.glow}`;
        card.style.background = `linear-gradient(180deg, ${theme.bg} 0%, rgba(11, 14, 26, 0.95) 100%)`;

        // Render score breakdown
        const breakdownContainer = document.getElementById("score-breakdown-container");
        breakdownContainer.innerHTML = "";
        const houseNames = {
            "GRY": "Gryffindor",
            "RAV": "Ravenclaw",
            "HUF": "Hufflepuff",
            "SLY": "Slytherin"
        };

        const scores = assignment.score_breakdown || {};
        const maxScore = Math.max(...Object.values(scores), 1);

        for (const [code, score] of Object.entries(scores)) {
            const pct = Math.round((score / maxScore) * 100);
            const row = document.createElement("div");
            row.className = "breakdown-bar-row";
            const barColor = houseTheme[code] ? houseTheme[code].bar : "#f5c518";
            row.innerHTML = `
                <div class="breakdown-label-row">
                    <span>${icons[code] || ''} ${houseNames[code] || code}</span>
                    <span>${score} pts (${pct}%)</span>
                </div>
                <div class="breakdown-track">
                    <div class="breakdown-fill" style="width: ${pct}%; background-color: ${barColor};"></div>
                </div>
            `;
            breakdownContainer.appendChild(row);
        }
    }

    playMagicalHum() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.5);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 1.5);
        } catch (e) {}
    }

    playFanfare() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
                gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.6);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + idx * 0.15);
                osc.stop(ctx.currentTime + idx * 0.15 + 0.6);
            });
        } catch (e) {}
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.app = new GuestApp();
});
