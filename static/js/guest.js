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
        const prevBtn = document.getElementById("btn-prev");
        if (prevBtn) prevBtn.addEventListener("click", () => this.handlePrev());

        const nextBtn = document.getElementById("btn-next");
        if (nextBtn) nextBtn.addEventListener("click", () => this.handleNext());

        const submitBtn = document.getElementById("btn-submit-sorting");
        if (submitBtn) submitBtn.addEventListener("click", () => this.handleFinalSubmit());

        const breakdownBtn = document.getElementById("btn-toggle-breakdown");
        if (breakdownBtn) {
            breakdownBtn.addEventListener("click", () => {
                const box = document.getElementById("score-breakdown-container");
                if (box) box.classList.toggle("hidden");
            });
        }

        // House Games buttons
        const openGamesBtn = document.getElementById("btn-open-games");
        if (openGamesBtn) openGamesBtn.addEventListener("click", () => this.openHouseGames());

        const gotoGamesBtn = document.getElementById("btn-goto-games");
        if (gotoGamesBtn) gotoGamesBtn.addEventListener("click", () => this.openHouseGames());

        const closeGamesBtn = document.getElementById("btn-close-games");
        if (closeGamesBtn) closeGamesBtn.addEventListener("click", () => this.closeHouseGames());

        const playGameBtn = document.getElementById("btn-play-game");
        if (playGameBtn) playGameBtn.addEventListener("click", () => this.playHouseGame());

        const gamesLoginForm = document.getElementById("form-games-login");
        if (gamesLoginForm) {
            gamesLoginForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleGamesLogin();
            });
        }

        // Sort Another Wizard buttons
        const sortAnotherHeader = document.getElementById("btn-header-sort-another");
        if (sortAnotherHeader) sortAnotherHeader.addEventListener("click", () => this.sortAnotherWizard());

        const sortAnotherResult = document.getElementById("btn-result-sort-another");
        if (sortAnotherResult) sortAnotherResult.addEventListener("click", () => this.sortAnotherWizard());

        // Close modal on backdrop click
        const gamesModal = document.getElementById("modal-house-games");
        if (gamesModal) {
            gamesModal.addEventListener("click", (e) => {
                if (e.target === gamesModal) this.closeHouseGames();
            });
        }

        // Language change event listener
        window.addEventListener("langchange", async (e) => {
            if (this.assignment) {
                await this.fetchMyAssignment();
            } else if (this.questions && this.questions.length > 0) {
                try {
                    const lang = window.i18n.getLang();
                    const res = await fetch(`/api/questions?lang=${lang}&randomize=false`);
                    if (res.ok) {
                        const fresh = await res.json();
                        const qMap = {};
                        fresh.forEach(q => { qMap[q.id] = q; });
                        this.questions.forEach(q => {
                            if (qMap[q.id]) {
                                q.text = qMap[q.id].text;
                                const optMap = {};
                                qMap[q.id].options.forEach(o => { optMap[o.id] = o.text; });
                                q.options.forEach(o => {
                                    if (optMap[o.id]) o.text = optMap[o.id];
                                });
                            }
                        });
                        this.renderCurrentQuestion();
                    }
                } catch (err) {
                    console.error("Error refreshing question language", err);
                }
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
        const passInput = document.getElementById("participant-password");
        const name = nameInput ? nameInput.value.trim() : "";
        const password = passInput ? passInput.value.trim() : "";
        this.clearError("register-error");

        if (name.length < 2 || name.length > 40) {
            this.showError("register-error", window.i18n.t("err_name_required"));
            return;
        }

        if (!password || password.length < 3) {
            this.showError("register-error", window.i18n.t("err_password_required"));
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
        if (btn) btn.disabled = true;

        try {
            const lang = window.i18n.getLang();
            const res = await fetch("/api/participants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ display_name: name, preferred_lang: lang, password: password })
            });

            const data = await res.json();
            if (res.status === 200 || res.status === 201) {
                // Clear the form fields immediately upon registration
                if (nameInput) nameInput.value = "";
                if (passInput) passInput.value = "";

                this.participant = data;
                this.sessionToken = data.session_token;

                if (data.has_assignment) {
                    await this.fetchMyAssignment();
                } else {
                    await this.loadQuestions();
                    await this.loadSavedAnswers();
                    this.showStep("step-questionnaire");
                }
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
            console.error("handleRegister error:", err);
            this.showError("register-error", "Registration error. Please try again.");
        } finally {
            if (btn) btn.disabled = false;
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
        const houseThemes = ["gry", "sly", "rav", "huf"];
        const crestMap = {
            "gry": "/static/images/crest_gryffindor.jpg",
            "sly": "/static/images/crest_slytherin.jpg",
            "rav": "/static/images/crest_ravenclaw.jpg",
            "huf": "/static/images/crest_hufflepuff.jpg"
        };

        q.options.forEach((opt, idx) => {
            const theme = houseThemes[idx % 4];
            const crestImg = crestMap[theme];
            const card = document.createElement("div");
            card.className = `option-card theme-${theme}`;
            if (this.selectedAnswers[q.id] === opt.id) {
                card.classList.add("selected");
            }

            const animalMap = {
                "theme-gry": "lion",
                "theme-sly": "serpent",
                "theme-rav": "eagle",
                "theme-huf": "badger"
            };
            const animal = animalMap[theme] || "lion";

            card.innerHTML = `
                <div class="option-dither-overlay"></div>
                <div class="option-watermark ${animal}"></div>
                <div class="option-crest-box">
                    <img src="${crestImg}" alt="${theme}" class="option-crest-img">
                </div>
                <div class="option-text">${this.escapeHtml(opt.text)}</div>
                <div class="option-check-circle"></div>
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

        if (prevBtn) prevBtn.disabled = this.currentIndex === 0;
        if (this.currentIndex === total - 1) {
            if (nextBtn) nextBtn.classList.add("hidden");
            if (submitBtn) submitBtn.classList.remove("hidden");
        } else {
            if (nextBtn) nextBtn.classList.remove("hidden");
            if (submitBtn) submitBtn.classList.add("hidden");
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
        const wizardNameEl = document.getElementById("result-wizard-name");
        const title = document.getElementById("result-house-name");
        const motto = document.getElementById("result-house-motto");
        const crestImgEl = document.getElementById("result-crest-img");
        const crestAuraEl = document.getElementById("crest-aura");

        const houseTheme = {
            "GRY": { text: "#fca5a5", glow: "rgba(239, 68, 68, 0.7)", border: "#ef4444", bg: "rgba(116, 0, 1, 0.35)", bar: "#ef4444", img: "/static/images/crest_gryffindor.jpg" },
            "RAV": { text: "#93c5fd", glow: "rgba(59, 130, 246, 0.7)", border: "#3b82f6", bg: "rgba(14, 26, 64, 0.5)", bar: "#3b82f6", img: "/static/images/crest_ravenclaw.jpg" },
            "HUF": { text: "#fde047", glow: "rgba(234, 179, 8, 0.7)", border: "#eab308", bg: "rgba(236, 185, 57, 0.3)", bar: "#eab308", img: "/static/images/crest_hufflepuff.jpg" },
            "SLY": { text: "#86efac", glow: "rgba(34, 197, 94, 0.7)", border: "#22c55e", bg: "rgba(26, 71, 42, 0.4)", bar: "#22c55e", img: "/static/images/crest_slytherin.jpg" }
        };

        const theme = houseTheme[assignment.house_code] || {
            text: "#f5c518", glow: "rgba(245, 197, 24, 0.6)", border: "#d3a625", bg: "rgba(22, 27, 46, 0.95)", bar: "#f5c518", img: "/static/images/crest_gryffindor.jpg"
        };

        if (wizardNameEl) {
            wizardNameEl.textContent = this.participant ? this.participant.display_name : "";
        }

        title.textContent = assignment.house_name;
        title.style.color = theme.text;
        title.style.textShadow = `0 0 25px ${theme.glow}, 0 2px 6px rgba(0,0,0,0.9)`;
        motto.textContent = `"${assignment.motto}"`;
        
        if (crestImgEl) {
            crestImgEl.src = theme.img;
            crestImgEl.alt = assignment.house_name;
        }

        if (crestAuraEl) {
            crestAuraEl.style.background = `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`;
        }

        // House color aura & background
        card.style.borderColor = theme.border;
        card.style.boxShadow = `0 0 35px ${theme.glow}`;
        card.style.background = `linear-gradient(180deg, ${theme.bg} 0%, rgba(11, 14, 26, 0.95) 100%)`;

        const watermarkEl = document.getElementById("result-watermark");
        if (watermarkEl) {
            const animalMap = { "GRY": "lion", "SLY": "serpent", "RAV": "eagle", "HUF": "badger" };
            watermarkEl.className = `result-watermark-silhouette ${animalMap[assignment.house_code] || 'lion'}`;
        }

        // Show header sort another button
        const headerSortBtn = document.getElementById("btn-header-sort-another");
        if (headerSortBtn) headerSortBtn.classList.remove("hidden");

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
            const crestIcon = houseTheme[code] ? `<img src="${houseTheme[code].img}" class="crest-img-sm" style="margin-right: 6px;">` : '';
            row.innerHTML = `
                <div class="breakdown-label-row">
                    <span style="display: inline-flex; align-items: center;">${crestIcon} ${houseNames[code] || code}</span>
                    <span>${score} pts (${pct}%)</span>
                </div>
                <div class="breakdown-track">
                    <div class="breakdown-fill" style="width: ${pct}%; background-color: ${barColor};"></div>
                </div>
            `;
            breakdownContainer.appendChild(row);
        }
    }

    async openHouseGames() {
        const modal = document.getElementById("modal-house-games");
        if (!modal) return;
        modal.style.display = "flex";
        modal.classList.remove("hidden");

        const authView = document.getElementById("games-auth-view");
        const unauthView = document.getElementById("games-unauth-view");
        const resultBox = document.getElementById("game-play-result");
        if (resultBox) resultBox.classList.add("hidden");

        if (this.participant && this.assignment) {
            authView.classList.remove("hidden");
            unauthView.classList.add("hidden");

            const crestUrls = {
                "GRY": "/static/images/crest_gryffindor.jpg",
                "RAV": "/static/images/crest_ravenclaw.jpg",
                "HUF": "/static/images/crest_hufflepuff.jpg",
                "SLY": "/static/images/crest_slytherin.jpg"
            };
            const crestUrl = crestUrls[this.assignment.house_code] || "/static/images/crest_gryffindor.jpg";
            
            const crestBox = document.getElementById("games-house-crest");
            if (crestBox) {
                crestBox.innerHTML = `<img src="${crestUrl}" alt="House Crest" class="crest-img-md" style="border-radius: 8px;">`;
            }
            document.getElementById("games-house-name").textContent = this.assignment.house_name;
            document.getElementById("games-wizard-name").textContent = this.participant.display_name;

            // Update casts count
            const castCountEl = document.getElementById("games-cast-count");
            const btn = document.getElementById("btn-play-game");
            const used = this.participant.casts_used || 0;
            if (castCountEl) castCountEl.textContent = used;

            if (used >= 2) {
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = window.i18n.t("btn_max_spells_reached");
                }
            } else {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = window.i18n.t("btn_cast_spell_count", { used: used });
                }
            }

            // Fetch latest house points & me data
            try {
                const meRes = await fetch("/api/me");
                if (meRes.ok) {
                    const meData = await meRes.json();
                    this.participant.casts_used = meData.casts_used;
                    this.participant.casts_remaining = meData.casts_remaining;
                    if (castCountEl) castCountEl.textContent = meData.casts_used;
                    if (btn) {
                        if (meData.casts_used >= 2) {
                            btn.disabled = true;
                            btn.textContent = window.i18n.t("btn_max_spells_reached");
                        } else {
                            btn.disabled = false;
                            btn.textContent = window.i18n.t("btn_cast_spell_count", { used: meData.casts_used });
                        }
                    }
                }

                const res = await fetch("/api/houses");
                if (res.ok) {
                    const houses = await res.json();
                    const myH = houses.find(h => h.code === this.assignment.house_code);
                    if (myH) {
                        const ptsStr = (myH.game_points % 1 === 0) ? myH.game_points : myH.game_points.toFixed(1);
                        document.getElementById("games-house-total-points").textContent = `${ptsStr} 🏆`;
                    }
                }
            } catch (e) {}
        } else {
            authView.classList.add("hidden");
            unauthView.classList.remove("hidden");
        }
    }

    closeHouseGames() {
        const modal = document.getElementById("modal-house-games");
        if (modal) {
            modal.style.display = "none";
            modal.classList.add("hidden");
        }
    }

    async playHouseGame() {
        const btn = document.getElementById("btn-play-game");
        const orb = document.getElementById("games-orb");
        const resultBox = document.getElementById("game-play-result");
        const castCountEl = document.getElementById("games-cast-count");

        if (btn) btn.disabled = true;
        if (orb) orb.style.transform = "scale(1.3) rotate(360deg)";

        try {
            const res = await fetch("/api/house-games/play", {
                method: "POST"
            });

            if (res.ok) {
                const data = await res.json();
                this.participant.casts_used = data.casts_used;
                this.participant.casts_remaining = data.casts_remaining;

                if (castCountEl) castCountEl.textContent = data.casts_used;

                const ptsStr = (data.total_game_points % 1 === 0) ? data.total_game_points : data.total_game_points.toFixed(1);
                document.getElementById("games-house-total-points").textContent = `${ptsStr} 🏆`;
                
                if (resultBox) {
                    resultBox.textContent = data.message;
                    resultBox.classList.remove("hidden");
                }

                if (data.casts_remaining <= 0) {
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = "🔒 Max Spells Cast (2/2)";
                    }
                } else {
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = `🎲 Cast Magical Spell (${data.casts_used}/2) ✨`;
                    }
                }

                this.playFanfare();
            } else {
                const err = await res.json().catch(() => ({}));
                if (resultBox) {
                    resultBox.textContent = err.detail || "Unable to play House Games.";
                    resultBox.classList.remove("hidden");
                }
                if (err.detail && err.detail.includes("maximum spells")) {
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = "🔒 Max Spells Cast (2/2)";
                    }
                    if (castCountEl) castCountEl.textContent = "2";
                }
            }
        } catch (e) {
            if (resultBox) {
                resultBox.textContent = "Network error. Please try again.";
                resultBox.classList.remove("hidden");
            }
        } finally {
            if (orb) orb.style.transform = "none";
            setTimeout(() => {
                if (btn && (this.participant.casts_used < 2)) btn.disabled = false;
            }, 800);
        }
    }

    async handleGamesLogin() {
        const nameInput = document.getElementById("games-login-name");
        const passInput = document.getElementById("games-login-password");
        const name = nameInput ? nameInput.value.trim() : "";
        const password = passInput ? passInput.value.trim() : "";
        this.clearError("games-login-error");

        if (name.length < 2) {
            this.showError("games-login-error", window.i18n.t("err_name_required"));
            return;
        }
        if (!password || password.length < 3) {
            this.showError("games-login-error", window.i18n.t("err_password_required"));
            return;
        }

        const btn = document.getElementById("btn-games-login-submit");
        if (btn) btn.disabled = true;

        try {
            const lang = window.i18n.getLang();
            const res = await fetch("/api/participants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ display_name: name, preferred_lang: lang, password: password })
            });

            const data = await res.json();
            if (res.status === 200 || res.status === 201) {
                if (nameInput) nameInput.value = "";
                if (passInput) passInput.value = "";

                this.participant = data;
                this.sessionToken = data.session_token;

                if (data.has_assignment) {
                    await this.fetchMyAssignment();
                    await this.openHouseGames();
                } else {
                    this.closeHouseGames();
                    await this.loadQuestions();
                    await this.loadSavedAnswers();
                    this.showStep("step-questionnaire");
                }
            } else {
                this.showError("games-login-error", data.detail || "Login failed.");
            }
        } catch (e) {
            this.showError("games-login-error", "Network connection error.");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async sortAnotherWizard() {
        try {
            await fetch("/api/participants/logout", { method: "POST" });
        } catch (e) {}

        this.participant = null;
        this.sessionToken = null;
        this.assignment = null;
        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswers = {};

        const headerBtn = document.getElementById("btn-header-sort-another");
        if (headerBtn) headerBtn.classList.add("hidden");

        const nameInput = document.getElementById("display-name");
        const passInput = document.getElementById("participant-password");
        if (nameInput) nameInput.value = "";
        if (passInput) passInput.value = "";
        this.clearError("register-error");

        this.closeHouseGames();
        this.showStep("step-register");
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

    escapeHtml(str) {
        if (!str) return "";
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.app = new GuestApp();
});
