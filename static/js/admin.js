// Admin Dashboard Controller

class AdminApp {
    constructor() {
        this.token = this.getStoredToken();
        this.participants = [];
        this.questions = [];
        this.currentTab = "roster";
        this.selectedParticipantId = null;
        this.currentHouseFilter = "ALL";
        this.currentSearchQuery = "";

        this.init();
    }

    getStoredToken() {
        return localStorage.getItem("admin_token") 
            || sessionStorage.getItem("admin_token") 
            || this.getCookie("admin_auth_session") 
            || null;
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    init() {
        this.hideAllModals();
        this.bindEvents();
        if (this.token) {
            this.showDashboard();
        } else {
            this.showLogin();
        }
    }

    bindEvents() {
        // Login form
        const loginForm = document.getElementById("form-admin-login");
        if (loginForm) {
            loginForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Logout
        document.getElementById("btn-logout").addEventListener("click", () => this.handleLogout());

        // Balancing toggle
        const toggleBalancing = document.getElementById("toggle-balancing");
        if (toggleBalancing) {
            toggleBalancing.addEventListener("change", (e) => this.handleBalancingToggle(e.target.checked));
        }

        // House Filter Buttons
        document.querySelectorAll(".house-filter-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".house-filter-btn").forEach(b => b.classList.remove("active"));
                const target = e.currentTarget;
                target.classList.add("active");
                this.currentHouseFilter = target.getAttribute("data-filter") || "ALL";
                this.applyFilters();
            });
        });

        // Search roster
        const searchInput = document.getElementById("roster-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => this.filterRoster(e.target.value));
        }

        // Action Toolbar
        document.getElementById("btn-reset-event").addEventListener("click", () => this.handleResetEvent());
        document.getElementById("btn-auto-balance").addEventListener("click", () => this.handleAutoBalance());
        document.getElementById("btn-export-csv").addEventListener("click", () => this.handleExportCsv());
        document.getElementById("btn-show-qr").addEventListener("click", () => this.handleShowQr());
        document.getElementById("btn-closing-stats").addEventListener("click", () => this.handleShowStats());

        // QR Modal Controls
        const qrInput = document.getElementById("qr-url-input");
        if (qrInput) {
            qrInput.addEventListener("input", (e) => this.updateQrCode(e.target.value.trim()));
        }
        const btnCopyQr = document.getElementById("btn-copy-qr-url");
        if (btnCopyQr) {
            btnCopyQr.addEventListener("click", () => this.copyQrUrl());
        }
        const btnDetectIp = document.getElementById("btn-detect-ip");
        if (btnDetectIp) {
            btnDetectIp.addEventListener("click", () => this.autoDetectIp());
        }

        // Admin Navigation Tabs
        document.querySelectorAll(".admin-tab-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const tab = e.currentTarget.getAttribute("data-tab");
                this.switchTab(tab);
            });
        });

        // Question Manager Toolbar & Modals
        const btnAddQ = document.getElementById("btn-add-question");
        if (btnAddQ) {
            btnAddQ.addEventListener("click", () => this.openAddQuestionModal());
        }
        const btnCancelQ = document.getElementById("btn-cancel-question");
        if (btnCancelQ) {
            btnCancelQ.addEventListener("click", () => this.hideModal("modal-question"));
        }
        const qForm = document.getElementById("form-question-editor");
        if (qForm) {
            qForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveQuestion();
            });
        }

        // Student Detail Modal Buttons
        const btnCloseDetail = document.getElementById("btn-close-detail");
        if (btnCloseDetail) {
            btnCloseDetail.addEventListener("click", () => this.hideModal("modal-student-detail"));
        }
        const btnDetailEdit = document.getElementById("btn-detail-edit-points");
        if (btnDetailEdit) {
            btnDetailEdit.addEventListener("click", () => {
                if (this.activeDetailParticipant) {
                    const participantId = this.activeDetailParticipant.id;
                    this.hideModal("modal-student-detail");
                    this.openEditPointsModal(participantId);
                }
            });
        }
        const btnDetailReassign = document.getElementById("btn-detail-reassign");
        if (btnDetailReassign) {
            btnDetailReassign.addEventListener("click", () => {
                if (this.activeDetailParticipant) {
                    const participantId = this.activeDetailParticipant.id;
                    const participantName = this.activeDetailParticipant.display_name;
                    this.hideModal("modal-student-detail");
                    this.openReassignModal(participantId, participantName);
                }
            });
        }
        const btnDetailDelete = document.getElementById("btn-detail-delete");
        if (btnDetailDelete) {
            btnDetailDelete.addEventListener("click", async () => {
                if (this.activeDetailParticipant) {
                    const pid = this.activeDetailParticipant.id;
                    this.hideModal("modal-student-detail");
                    await this.deleteParticipant(pid);
                }
            });
        }

        // Modals Buttons
        const btnCancelEditPts = document.getElementById("btn-cancel-edit-points");
        if (btnCancelEditPts) {
            btnCancelEditPts.addEventListener("click", () => this.hideModal("modal-edit-points"));
        }
        const formEditPts = document.getElementById("form-edit-points");
        if (formEditPts) {
            formEditPts.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleSaveEditPoints();
            });
        }

        document.getElementById("btn-cancel-reassign").addEventListener("click", () => this.hideModal("modal-reassign"));
        document.getElementById("btn-save-reassign").addEventListener("click", () => this.saveReassignment());
        document.getElementById("btn-close-qr").addEventListener("click", () => this.hideModal("modal-qr"));
        document.getElementById("btn-close-stats").addEventListener("click", () => this.hideModal("modal-stats"));

        // Backdrop click to close modals
        document.querySelectorAll(".modal-overlay").forEach(overlay => {
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    this.hideModal(overlay.id);
                }
            });
        });

        // Escape key to close modals
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.hideAllModals();
            }
        });

        // Language change event
        window.addEventListener("langchange", () => {
            const token = this.token || this.getStoredToken();
            if (token) {
                this.token = token;
                this.renderAdminProfile();
                this.loadAdminProfile();
                if (this.currentTab === "questions") {
                    this.renderQuestions();
                } else {
                    this.loadParticipants();
                }
                
                // Only update student detail text if modal is ALREADY actively open on screen
                const detailModal = document.getElementById("modal-student-detail");
                if (detailModal && !detailModal.classList.contains("hidden") && detailModal.style.display !== "none" && this.activeDetailParticipant) {
                    this.populateStudentDetail(this.activeDetailParticipant);
                }
            } else {
                const errEl = document.getElementById("login-error");
                if (errEl && !errEl.classList.contains("hidden") && errEl.getAttribute("data-err-key")) {
                    errEl.textContent = window.i18n.t(errEl.getAttribute("data-err-key"));
                }
            }
        });
    }

    showLogin() {
        document.getElementById("admin-login-view").classList.add("active");
        document.getElementById("admin-dashboard-view").classList.remove("active");
        document.getElementById("btn-logout").classList.add("hidden");
        const badge = document.getElementById("admin-user-badge");
        if (badge) badge.classList.add("hidden");
    }

    async showDashboard() {
        document.getElementById("admin-login-view").classList.remove("active");
        document.getElementById("admin-dashboard-view").classList.add("active");
        document.getElementById("btn-logout").classList.remove("hidden");

        await this.loadAdminProfile();
        this.loadSettings();
        this.loadParticipants();
        this.loadQuestions();
    }

    async loadAdminProfile() {
        const token = this.token || this.getStoredToken();
        if (!token) return;
        this.token = token;

        try {
            const res = await fetch("/api/admin/me", { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.adminData = await res.json();
                this.renderAdminProfile();
            } else if (res.status === 401) {
                this.handleLogout();
            }
        } catch (e) {
            console.error("Failed to load admin profile", e);
        }
    }

    renderAdminProfile() {
        if (!this.adminData) return;
        const badge = document.getElementById("admin-user-badge");
        const nameEl = document.getElementById("admin-user-name");
        const roleEl = document.getElementById("admin-user-role");
        if (badge && nameEl && roleEl) {
            nameEl.textContent = this.adminData.full_name || this.adminData.username;
            const rawRole = (this.adminData.role || "Headmaster").toLowerCase().replace(/[\s.-]+/g, "_");
            const roleKey = `role_${rawRole}`;
            const translatedRole = window.i18n.t(roleKey);
            roleEl.textContent = (translatedRole !== roleKey ? translatedRole : (this.adminData.role || "Headmaster")).toUpperCase();
            badge.classList.remove("hidden");
        }
    }

    async handleLogin() {
        const usernameInput = document.getElementById("admin-username");
        const username = usernameInput ? usernameInput.value.trim() : "admin";
        const pwd = document.getElementById("admin-password").value;
        const errEl = document.getElementById("login-error");
        errEl.classList.add("hidden");
        errEl.removeAttribute("data-err-key");

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username, password: pwd })
            });

            if (res.ok) {
                const data = await res.json();
                this.token = data.token;
                localStorage.setItem("admin_token", data.token);
                sessionStorage.setItem("admin_token", data.token);
                errEl.classList.add("hidden");
                await this.showDashboard();
            } else {
                errEl.setAttribute("data-err-key", "err_invalid_credentials");
                errEl.textContent = window.i18n.t("err_invalid_credentials");
                errEl.classList.remove("hidden");
            }
        } catch (e) {
            errEl.setAttribute("data-err-key", "err_connection");
            errEl.textContent = window.i18n.t("err_connection");
            errEl.classList.remove("hidden");
        }
    }

    async handleLogout() {
        try {
            await fetch("/api/admin/logout", {
                method: "POST",
                headers: this.getAuthHeaders()
            });
        } catch (e) {}
        this.token = null;
        localStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_token");
        document.cookie = "admin_auth_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        this.showLogin();
    }

    getAuthHeaders() {
        const token = this.token || this.getStoredToken() || "";
        return {
            "Content-Type": "application/json",
            "X-Admin-Token": token
        };
    }

    async loadSettings() {
        try {
            const res = await fetch("/api/admin/settings", { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                document.getElementById("toggle-balancing").checked = data.balancing_mode;
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    }

    async handleBalancingToggle(checked) {
        try {
            await fetch("/api/admin/settings", {
                method: "POST",
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ balancing_mode: checked })
            });
        } catch (e) {
            console.error("Failed to update balancing mode", e);
        }
    }

    async loadParticipants() {
        const token = this.token || this.getStoredToken();
        if (!token) return;
        this.token = token;

        try {
            const lang = window.i18n.getLang();
            const res = await fetch(`/api/admin/participants?lang=${lang}`, { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.participants = await res.json();
                this.applyFilters();
                this.updateSummaryCounters();
            } else if (res.status === 401) {
                this.handleLogout();
            }
        } catch (e) {
            console.error("Failed to load participants", e);
        }
    }

    updateSummaryCounters() {
        document.getElementById("stat-registered-count").textContent = this.participants.length;
        const sorted = this.participants.filter(p => p.house_code).length;
        document.getElementById("stat-sorted-count").textContent = sorted;
    }

    applyFilters() {
        const q = (this.currentSearchQuery || "").toLowerCase().trim();
        const house = this.currentHouseFilter || "ALL";

        const filtered = this.participants.filter(p => {
            const matchesName = !q || (p.display_name && p.display_name.toLowerCase().includes(q));
            const matchesHouse = (house === "ALL") || (p.house_code === house);
            return matchesName && matchesHouse;
        });

        this.renderRoster(filtered);
    }

    renderRoster(list) {
        const tbody = document.getElementById("roster-tbody");
        tbody.innerHTML = "";

        if (list.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">${window.i18n.t('no_participants_found')}</td>`;
            tbody.appendChild(tr);
            return;
        }

        const crestImages = {
            "GRY": "/static/images/crest_gryffindor.jpg",
            "RAV": "/static/images/crest_ravenclaw.jpg",
            "HUF": "/static/images/crest_hufflepuff.jpg",
            "SLY": "/static/images/crest_slytherin.jpg"
        };

        list.forEach(p => {
            const tr = document.createElement("tr");
            tr.className = "clickable-row";
            tr.setAttribute("title", window.i18n.t("btn_view_profile"));

            const crestImgTag = (p.house_code && crestImages[p.house_code]) 
                ? `<img src="${crestImages[p.house_code]}" class="crest-img-sm" style="margin-right: 4px;" alt="${p.house_name}">` 
                : '';

            const houseHtml = p.house_code 
                ? `<span class="house-tag ${p.house_code}">${crestImgTag} ${p.house_name}</span>
                   ${p.manual_override ? `<span class="manual-badge">${window.i18n.t('badge_manual')}</span>` : ''}`
                : `<span style="color: var(--text-muted);">${window.i18n.t('not_sorted_yet')} (${p.answered_questions}/6)</span>`;

            const ptsWon = (p.spell_points_won !== null && p.spell_points_won !== undefined)
                ? ((p.spell_points_won % 1 === 0) ? p.spell_points_won : Number(p.spell_points_won).toFixed(1))
                : 0;
            const houseCupPtsHtml = `<strong style="color: var(--gold-primary); font-size: 1.05rem;">+${ptsWon} pts</strong>`;
            const spellsHtml = `<span style="color: var(--text-light); font-size: 0.9rem;">🔮 ${p.spells_cast || 0}/2</span>`;

            tr.innerHTML = `
                <td><strong>#${p.id}</strong></td>
                <td><strong style="font-size: 1.02rem; color: #ffffff;">${this.escapeHtml(p.display_name)}</strong></td>
                <td>${houseHtml}</td>
                <td>${houseCupPtsHtml}</td>
                <td>${spellsHtml}</td>
                <td class="actions-cell">
                    <button type="button" class="btn-magical small-btn" onclick="event.stopPropagation(); window.adminApp.openStudentDetailById(${p.id})">${window.i18n.t('btn_view_profile')}</button>
                    <button type="button" class="btn-outline small-btn" style="border-color: var(--gold-primary); color: var(--gold-primary);" onclick="event.stopPropagation(); window.adminApp.openEditPointsModal(${p.id})">${window.i18n.t('btn_edit_points')}</button>
                </td>
            `;

            tr.addEventListener("click", () => {
                this.openStudentDetail(p);
            });

            tbody.appendChild(tr);
        });
    }

    openStudentDetailById(participantId) {
        const p = this.participants.find(item => item.id === participantId);
        if (p) {
            this.openStudentDetail(p);
        }
    }

    openStudentDetail(p) {
        this.activeDetailParticipant = p;
        this.populateStudentDetail(p);
        this.showModal("modal-student-detail");
    }

    populateStudentDetail(p) {
        const crestImages = {
            "GRY": "/static/images/crest_gryffindor.jpg",
            "RAV": "/static/images/crest_ravenclaw.jpg",
            "HUF": "/static/images/crest_hufflepuff.jpg",
            "SLY": "/static/images/crest_slytherin.jpg"
        };

        const famousWizards = {
            "en": {
                "GRY": {
                    name: "Prof. Albus Dumbledore",
                    desc: "Revered Headmaster of Hogwarts, leader of the brave and one of the most powerful wizards of all time.",
                    img: "/static/images/wizard_gryffindor.jpg",
                    animal: "lion"
                },
                "SLY": {
                    name: "Prof. Severus Snape",
                    desc: "Potions Master and legendary leader of Slytherin, renowned for cunning intellect and unwavering resolve.",
                    img: "/static/images/wizard_slytherin.jpg",
                    animal: "serpent"
                },
                "RAV": {
                    name: "Luna Lovegood",
                    desc: "Distinguished Ravenclaw witch, celebrated for unconventional wisdom, open-minded insight, and boundless creativity.",
                    img: "/static/images/wizard_ravenclaw.jpg",
                    animal: "eagle"
                },
                "HUF": {
                    name: "Newt Scamander",
                    desc: "Renowned Magizoologist and Hufflepuff alumnus, remembered for boundless compassion toward all magical creatures.",
                    img: "/static/images/wizard_hufflepuff.jpg",
                    animal: "badger"
                }
            },
            "de": {
                "GRY": {
                    name: "Prof. Albus Dumbledore",
                    desc: "Verehrter Schulleiter von Hogwarts, Anführer der Tapferen und einer der mächtigsten Zauberer aller Zeiten.",
                    img: "/static/images/wizard_gryffindor.jpg",
                    animal: "lion"
                },
                "SLY": {
                    name: "Prof. Severus Snape",
                    desc: "Zaubertrankmeister und legendärer Leiter von Slytherin, bekannt für scharfsinnigen Verstand und tiefe Loyalität.",
                    img: "/static/images/wizard_slytherin.jpg",
                    animal: "serpent"
                },
                "RAV": {
                    name: "Luna Lovegood",
                    desc: "Hervorragende Hexe aus Ravenclaw, gefeiert für unkonventionelle Weisheit, Offenheit und schöpferischen Geist.",
                    img: "/static/images/wizard_ravenclaw.jpg",
                    animal: "eagle"
                },
                "HUF": {
                    name: "Newt Scamander",
                    desc: "Renommierter Magizoologe und Hufflepuff-Absolvent, geschätzt für grenzenloses Mitgefühl für alle magischen Wesen.",
                    img: "/static/images/wizard_hufflepuff.jpg",
                    animal: "badger"
                }
            }
        };

        const currentLang = window.i18n.getLang() === "de" ? "de" : "en";
        const houseCode = p.house_code || "GRY";
        const wizardData = (famousWizards[currentLang] && famousWizards[currentLang][houseCode]) || famousWizards["en"]["GRY"];

        const crestEl = document.getElementById("detail-student-crest");
        const nameEl = document.getElementById("detail-student-name");
        const badgeEl = document.getElementById("detail-student-house-badge");
        const cupPtsEl = document.getElementById("detail-student-cup-pts");
        const spellsEl = document.getElementById("detail-student-spells");
        const quizEl = document.getElementById("detail-student-quiz");
        const langEl = document.getElementById("detail-student-lang");
        const dateEl = document.getElementById("detail-student-date");
        const watermarkEl = document.getElementById("detail-animal-watermark");

        const wizardImgEl = document.getElementById("detail-famous-wizard-img");
        const wizardNameEl = document.getElementById("detail-famous-wizard-name");
        const wizardDescEl = document.getElementById("detail-famous-wizard-desc");

        if (crestEl) {
            crestEl.src = crestImages[p.house_code] || "/static/images/sorting_hat.jpg";
        }
        if (nameEl) {
            nameEl.textContent = p.display_name || "Wizard";
        }
        if (badgeEl) {
            badgeEl.className = `house-tag ${p.house_code || 'GRY'}`;
            const houseNames = {
                "GRY": "Gryffindor",
                "RAV": "Ravenclaw",
                "HUF": "Hufflepuff",
                "SLY": "Slytherin"
            };
            badgeEl.textContent = p.house_code ? (houseNames[p.house_code] || p.house_name) : window.i18n.t("not_sorted_yet");
        }

        if (watermarkEl) {
            watermarkEl.className = `arch-watermark-silhouette ${wizardData.animal}`;
        }

        if (wizardImgEl) wizardImgEl.src = wizardData.img;
        if (wizardNameEl) wizardNameEl.textContent = wizardData.name;
        if (wizardDescEl) wizardDescEl.textContent = wizardData.desc;

        const ptsWon = (p.spell_points_won !== null && p.spell_points_won !== undefined)
            ? ((p.spell_points_won % 1 === 0) ? p.spell_points_won : Number(p.spell_points_won).toFixed(1))
            : 0;

        if (cupPtsEl) cupPtsEl.textContent = `+${ptsWon} pts 🏆`;
        if (spellsEl) spellsEl.textContent = window.i18n.t("lbl_profile_spells_cast_val", { count: p.spells_cast || 0 });
        if (quizEl) quizEl.textContent = p.total_score !== null && p.total_score !== undefined ? `${p.total_score} pts` : "—";
        if (langEl) langEl.textContent = (p.preferred_lang || "en").toUpperCase();
        if (dateEl) dateEl.textContent = p.assigned_at ? this.formatDateTime(p.assigned_at) : window.i18n.t("lbl_profile_not_assigned");

        window.i18n.applyTranslations();
    }

    formatDateTime(dateStr) {
        if (!dateStr) return "—";
        let normalized = dateStr.replace(" ", "T");
        if (!normalized.endsWith("Z") && !normalized.includes("+")) {
            normalized += "Z";
        }
        let d = new Date(normalized);
        if (isNaN(d.getTime())) {
            d = new Date(dateStr);
        }
        if (isNaN(d.getTime())) return dateStr;

        const lang = window.i18n.getLang() === "de" ? "de-DE" : "en-US";
        return d.toLocaleString(lang, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }

    filterRoster(query) {
        this.currentSearchQuery = query;
        this.applyFilters();
    }

    openReassignModal(participantId, name) {
        this.selectedParticipantId = participantId;
        const isDe = window.i18n.getLang() === "de";
        const participantLabel = document.getElementById("modal-reassign-participant");
        if (participantLabel) {
            participantLabel.textContent = `${isDe ? 'Teilnehmer' : 'Participant'}: ${name}`;
        }

        // Find participant to pre-select their current house
        const p = this.participants.find(item => item.id === participantId);
        const houseMapToId = { "GRY": 1, "RAV": 2, "HUF": 3, "SLY": 4 };
        const currentHouseId = (p && p.house_code) ? houseMapToId[p.house_code] : null;

        document.querySelectorAll('input[name="reassign-house"]').forEach(radio => {
            radio.checked = (currentHouseId !== null && parseInt(radio.value, 10) === currentHouseId);
        });

        // Compute current house occupancies
        const counts = { "GRY": 0, "RAV": 0, "HUF": 0, "SLY": 0 };
        this.participants.forEach(item => {
            if (item.house_code && counts[item.house_code] !== undefined) {
                counts[item.house_code]++;
            }
        });

        const setLabel = (code, count) => {
            const el = document.getElementById(`reassign-count-${code}`);
            if (el) {
                el.textContent = `(${count})`;
                el.style.color = count >= 3 ? "#fca5a5" : "#a7f3d0";
            }
        };

        setLabel("GRY", counts.GRY);
        setLabel("RAV", counts.RAV);
        setLabel("HUF", counts.HUF);
        setLabel("SLY", counts.SLY);

        this.showModal("modal-reassign");
    }

    async handleAutoBalance() {
        const isDe = window.i18n.getLang() === "de";
        const confirmed = await this.confirmDialog({
            icon: "⚖️",
            title: isDe ? "Häuser ausgleichen" : "Auto-Balance Houses",
            message: window.i18n.t("confirm_auto_balance"),
            confirmText: isDe ? "Ausgleichen" : "Balance Houses",
            isDanger: false
        });

        if (!confirmed) return;

        try {
            const res = await fetch("/api/admin/auto-balance", {
                method: "POST",
                headers: this.getAuthHeaders()
            });

            if (res.ok) {
                await this.loadParticipants();
                this.showToast(isDe ? "Teilnehmer wurden gleichmäßig verteilt!" : "Participants have been evenly balanced across all 4 houses!", "success");
            } else {
                this.showToast(isDe ? "Ausgleich fehlgeschlagen." : "Auto-balance failed.", "error");
            }
        } catch (e) {
            console.error("Auto-balance error", e);
            this.showToast(isDe ? "Verbindungsfehler." : "Network connection error.", "error");
        }
    }

    async saveReassignment() {
        const isDe = window.i18n.getLang() === "de";
        const selectedRadio = document.querySelector('input[name="reassign-house"]:checked');
        if (!selectedRadio) {
            this.showToast(isDe ? "Bitte wähle ein Haus aus." : "Please choose a house.", "warning");
            return;
        }

        const houseId = parseInt(selectedRadio.value, 10);
        try {
            const res = await fetch(`/api/admin/assignments/${this.selectedParticipantId}`, {
                method: "PATCH",
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ house_id: houseId })
            });

            if (res.ok) {
                this.hideModal("modal-reassign");
                await this.loadParticipants();
                this.showToast(isDe ? "Teilnehmer erfolgreich umgeteilt!" : "Participant successfully reassigned!", "success");
            } else {
                this.showToast(isDe ? "Umteilung fehlgeschlagen." : "Reassignment failed.", "error");
            }
        } catch (e) {
            this.showToast(isDe ? "Verbindungsfehler." : "Network connection error.", "error");
        }
    }

    async deleteParticipant(participantId) {
        const isDe = window.i18n.getLang() === "de";
        const confirmed = await this.confirmDialog({
            icon: "🗑️",
            title: isDe ? "Teilnehmer löschen" : "Delete Participant",
            message: window.i18n.t("confirm_delete"),
            confirmText: isDe ? "Löschen" : "Delete",
            isDanger: true
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/admin/participants/${participantId}`, {
                method: "DELETE",
                headers: this.getAuthHeaders()
            });

            if (res.ok) {
                await this.loadParticipants();
                this.showToast(isDe ? "Teilnehmer gelöscht." : "Participant deleted.", "success");
            } else {
                this.showToast(isDe ? "Löschen fehlgeschlagen." : "Deletion failed.", "error");
            }
        } catch (e) {
            this.showToast(isDe ? "Verbindungsfehler." : "Network connection error.", "error");
        }
    }

    async handleResetEvent() {
        const isDe = window.i18n.getLang() === "de";
        const confirmed = await this.confirmDialog({
            icon: "💥",
            title: isDe ? "Feier zurücksetzen" : "Reset Sorting Event",
            message: window.i18n.t("confirm_reset"),
            confirmText: isDe ? "Alles zurücksetzen" : "Reset Everything",
            isDanger: true
        });

        if (!confirmed) return;

        try {
            const res = await fetch("/api/admin/event/reset", {
                method: "POST",
                headers: this.getAuthHeaders()
            });

            if (res.ok) {
                await this.loadParticipants();
                this.showToast(isDe ? "Die Feier wurde zurückgesetzt." : "Event has been reset successfully. All assignments cleared.", "success");
            } else {
                this.showToast(isDe ? "Zurücksetzen fehlgeschlagen." : "Reset failed.", "error");
            }
        } catch (e) {
            this.showToast(isDe ? "Verbindungsfehler." : "Network connection error.", "error");
        }
    }

    confirmDialog({ icon = "⚠️", title = "Confirmation", message = "", confirmText = "Confirm", isDanger = false } = {}) {
        return new Promise((resolve) => {
            const iconEl = document.getElementById("confirm-modal-icon");
            const titleEl = document.getElementById("confirm-modal-title");
            const msgEl = document.getElementById("confirm-modal-msg");
            const btnAccept = document.getElementById("btn-confirm-accept");
            const btnCancel = document.getElementById("btn-confirm-cancel");

            if (iconEl) iconEl.textContent = icon;
            if (titleEl) titleEl.textContent = title;
            if (msgEl) msgEl.textContent = message;
            if (btnAccept) {
                btnAccept.textContent = confirmText;
                btnAccept.className = isDanger ? "btn-danger" : "btn-magical";
            }

            let cleanup = null;

            const onAccept = () => {
                cleanup();
                this.hideModal("modal-confirm");
                resolve(true);
            };

            const onCancel = () => {
                cleanup();
                this.hideModal("modal-confirm");
                resolve(false);
            };

            cleanup = () => {
                btnAccept.removeEventListener("click", onAccept);
                btnCancel.removeEventListener("click", onCancel);
            };

            btnAccept.addEventListener("click", onAccept);
            btnCancel.addEventListener("click", onCancel);

            this.showModal("modal-confirm");
        });
    }

    showToast(message, type = "info", duration = 3500) {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        const icons = {
            success: "✨",
            error: "❌",
            warning: "⚠️",
            info: "ℹ️"
        };

        toast.innerHTML = `
            <span style="font-size: 1.2rem;">${icons[type] || '✨'}</span>
            <span>${this.escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("fade-out");
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    handleExportCsv() {
        window.location.href = `/api/admin/export/csv?auth_token=${this.token}`;
    }

    async handleShowQr() {
        const savedUrl = localStorage.getItem("custom_qr_url");
        let initialUrl = savedUrl;

        if (!initialUrl) {
            // If admin is accessed from an IP (not localhost), use origin
            if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
                initialUrl = `${window.location.origin}/`;
            } else {
                // Fetch auto-detected LAN IP from backend
                try {
                    const res = await fetch("/api/server-info");
                    if (res.ok) {
                        const info = await res.json();
                        if (info.local_ip && info.local_ip.startsWith("172.") && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
                            initialUrl = `${window.location.origin}/`;
                        } else {
                            initialUrl = info.guest_url;
                        }
                    }
                } catch (e) {}
            }
        }

        if (!initialUrl) {
            initialUrl = `${window.location.origin}/`;
        }

        const qrInput = document.getElementById("qr-url-input");
        if (qrInput) {
            qrInput.value = initialUrl;
        }

        this.updateQrCode(initialUrl);
        this.showModal("modal-qr");
    }

    updateQrCode(url) {
        if (!url) return;
        const qrImg = document.getElementById("qr-img");
        if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
        }
        localStorage.setItem("custom_qr_url", url);
    }

    async autoDetectIp() {
        try {
            const res = await fetch("/api/server-info");
            if (res.ok) {
                const info = await res.json();
                let urlToUse = info.guest_url;
                if (info.local_ip && info.local_ip.startsWith("172.") && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
                    urlToUse = `${window.location.origin}/`;
                }
                const qrInput = document.getElementById("qr-url-input");
                if (qrInput) {
                    qrInput.value = urlToUse;
                }
                this.updateQrCode(urlToUse);
            }
        } catch (e) {
            this.showToast(window.i18n.getLang() === "de" ? "Lokale IP konnte nicht erkannt werden." : "Could not detect local IP automatically.", "warning");
        }
    }

    copyQrUrl() {
        const qrInput = document.getElementById("qr-url-input");
        if (qrInput && qrInput.value) {
            navigator.clipboard.writeText(qrInput.value).then(() => {
                const btn = document.getElementById("btn-copy-qr-url");
                if (btn) {
                    const orig = btn.textContent;
                    btn.textContent = "✅ Copied!";
                    setTimeout(() => btn.textContent = orig, 2000);
                }
            }).catch(() => {
                prompt("Copy the URL:", qrInput.value);
            });
        }
    }

    async handleShowStats() {
        try {
            const res = await fetch("/api/admin/stats", { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const container = document.getElementById("stats-content");
                const lang = window.i18n.getLang();

                const crestImages = {
                    "GRY": "/static/images/crest_gryffindor.jpg",
                    "RAV": "/static/images/crest_ravenclaw.jpg",
                    "HUF": "/static/images/crest_hufflepuff.jpg",
                    "SLY": "/static/images/crest_slytherin.jpg"
                };

                let housesHtml = (data.house_distribution || []).map(h => {
                    const houseName = lang === "de" ? h.name_de : h.name_en;
                    const percent = data.total_assigned > 0 ? Math.round((h.total / data.total_assigned) * 100) : 0;
                    return `
                        <div class="stats-row">
                            <span><img src="${crestImages[h.code] || ''}" class="crest-img-sm" style="margin-right: 6px;" alt="${houseName}"> <strong>${houseName}</strong></span>
                            <strong>${h.total} (${percent}%)</strong>
                        </div>
                    `;
                }).join("");

                let largestHouseHtml = "";
                if (data.largest_house && data.largest_house.total > 0) {
                    const lName = lang === "de" ? data.largest_house.name_de : data.largest_house.name_en;
                    largestHouseHtml = `
                        <div class="stats-row" style="background: rgba(245, 197, 24, 0.2); border: 1px solid var(--gold-primary);">
                            <span>🏆 ${lang === 'de' ? 'Größtes Haus des Abends' : 'Largest House of the Night'}:</span>
                            <strong style="color: var(--gold-primary); font-size: 1.1rem; display: inline-flex; align-items: center; gap: 6px;">
                                <img src="${crestImages[data.largest_house.code] || ''}" class="crest-img-sm" alt="${lName}"> ${lName} (${data.largest_house.total})
                            </strong>
                        </div>
                    `;
                }

                let divisiveHtml = "";
                if (data.most_divisive_question) {
                    const qText = lang === "de" ? data.most_divisive_question.text_de : data.most_divisive_question.text_en;
                    divisiveHtml = `
                        <div class="stats-row" style="flex-direction: column; align-items: flex-start; gap: 4px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3);">
                            <span style="font-size: 0.85rem; color: #93c5fd;">⚡ ${lang === 'de' ? 'Umstrittenste Frage' : 'Most Divisive Question'}:</span>
                            <span style="font-style: italic; font-size: 0.95rem;">"${this.escapeHtml(qText)}"</span>
                        </div>
                    `;
                }

                let incompleteHtml = "";
                if (data.incomplete_participants && data.incomplete_participants.length > 0) {
                    const names = data.incomplete_participants.map(p => this.escapeHtml(p.display_name)).join(", ");
                    incompleteHtml = `
                        <div class="stats-row" style="flex-direction: column; align-items: flex-start; gap: 4px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);">
                            <span style="font-size: 0.85rem; color: #fca5a5;">⏳ ${lang === 'de' ? 'In Bearbeitung / Nicht abgeschlossen' : 'In Progress / Not finished'} (${data.incomplete_participants.length}):</span>
                            <span style="font-size: 0.85rem; color: var(--text-muted);">${names}</span>
                        </div>
                    `;
                }

                let spellHouseStatsHtml = (data.house_spell_stats || []).map(h => {
                    const houseName = lang === "de" ? h.name_de : h.name_en;
                    const ptsStr = (h.game_points % 1 === 0) ? h.game_points : Number(h.game_points).toFixed(1);
                    return `
                        <div class="stats-row">
                            <span><img src="${crestImages[h.code] || ''}" class="crest-img-sm" style="margin-right: 6px;" alt="${houseName}"> <strong>${houseName}</strong></span>
                            <span><strong>${ptsStr} pts</strong> <small style="color: var(--text-muted);">(${h.spells_cast || 0} ${lang === 'de' ? 'Zauber' : 'spells'})</small></span>
                        </div>
                    `;
                }).join("");

                const totalSpellPtsStr = (data.total_spell_points % 1 === 0) ? data.total_spell_points : Number(data.total_spell_points).toFixed(1);

                container.innerHTML = `
                    <div class="stats-row" style="background: rgba(255, 255, 255, 0.05);">
                        <span>${lang === 'de' ? 'Registrierte Gäste' : 'Total Guests Registered'}:</span>
                        <strong>${data.total_participants}</strong>
                    </div>
                    <div class="stats-row" style="background: rgba(255, 255, 255, 0.05);">
                        <span>${lang === 'de' ? 'Zugeordnete Schüler' : 'Total Sorted Students'}:</span>
                        <strong>${data.total_assigned}</strong>
                    </div>
                    <div class="stats-row" style="background: rgba(245, 197, 24, 0.15); border: 1px solid rgba(245, 197, 24, 0.3);">
                        <span>🔮 ${lang === 'de' ? 'Gesamte Zauber gewirkt' : 'Total Spells Cast'}:</span>
                        <strong style="color: var(--gold-primary);">${data.total_spells_cast || 0} (${totalSpellPtsStr} pts)</strong>
                    </div>
                    ${largestHouseHtml}
                    ${divisiveHtml}
                    ${incompleteHtml}
                    <h4 style="color: var(--gold-primary); margin-top: 12px; margin-bottom: 4px;">🏆 ${lang === 'de' ? 'Hauspokal-Punkte & Zauber' : 'House Cup Points & Spells'}:</h4>
                    ${spellHouseStatsHtml}
                    <h4 style="color: var(--gold-primary); margin-top: 12px; margin-bottom: 4px;">👥 ${lang === 'de' ? 'Hausverteilung (Schüler)' : 'House Distribution (Students)'}:</h4>
                    ${housesHtml}
                `;

                this.showModal("modal-stats");
            } else {
                this.showToast(window.i18n.getLang() === "de" ? "Statistiken konnten nicht geladen werden." : "Failed to load statistics.", "error");
            }
        } catch (e) {
            console.error("handleShowStats error:", e);
            this.showToast(window.i18n.getLang() === "de" ? "Statistiken konnten nicht geladen werden." : "Failed to load statistics.", "error");
        }
    }

    showModal(id) {
        const m = document.getElementById(id);
        if (m) {
            m.style.display = "flex";
            m.classList.remove("hidden");
        }
    }

    hideModal(id) {
        const m = document.getElementById(id);
        if (m) {
            m.style.display = "none";
            m.classList.add("hidden");
        }
        if (id === "modal-student-detail") {
            this.activeDetailParticipant = null;
        }
    }

    hideAllModals() {
        document.querySelectorAll(".modal-overlay").forEach(m => {
            m.style.display = "none";
            m.classList.add("hidden");
        });
        this.activeDetailParticipant = null;
    }

    escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

    showError(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.classList.remove("hidden");
            el.style.display = "block";
        }
    }

    clearError(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = "";
            el.classList.add("hidden");
            el.style.display = "none";
        }
    }

    // --- Question Manager Methods ---

    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll(".admin-tab-btn").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-tab") === tabName);
        });
        const rosterContent = document.getElementById("tab-content-roster");
        const questionsContent = document.getElementById("tab-content-questions");
        if (tabName === "questions") {
            if (rosterContent) rosterContent.style.display = "none";
            if (questionsContent) {
                questionsContent.style.display = "block";
                this.loadQuestions();
            }
        } else {
            if (rosterContent) rosterContent.style.display = "block";
            if (questionsContent) questionsContent.style.display = "none";
            this.loadParticipants();
        }
    }

    async loadQuestions() {
        try {
            const res = await fetch("/api/admin/questions", { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.questions = await res.json();
                this.renderQuestions();
            }
        } catch (e) {
            console.error("Error loading questions", e);
        }
    }

    renderQuestions() {
        const container = document.getElementById("questions-container");
        if (!container) return;

        if (!this.questions || this.questions.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 30px; color: var(--text-muted);">
                    No questions found. Click "Add New Question" to create one.
                </div>
            `;
            return;
        }

        const currentLang = window.i18n.getLang();
        const badgeLabel = window.i18n.t("question_badge") || "Question";
        const editLabel = window.i18n.t("btn_edit") || "Edit";
        const deleteLabel = window.i18n.t("btn_delete") || "Delete";
        const markers = ["A", "B", "C", "D", "E", "F"];

        container.innerHTML = this.questions.map((q, idx) => {
            const optionsHtml = (q.options || []).map((opt, optIdx) => {
                const scores = opt.scores || {};
                const gry = scores["GRY"] || 0;
                const rav = scores["RAV"] || 0;
                const huf = scores["HUF"] || 0;
                const sly = scores["SLY"] || 0;

                const pills = [];
                if (gry > 0) pills.push(`<span class="score-pill gry"><img src="/static/images/crest_gryffindor.jpg" class="crest-img-sm" style="width:16px; height:16px;"> +${gry}</span>`);
                if (rav > 0) pills.push(`<span class="score-pill rav"><img src="/static/images/crest_ravenclaw.jpg" class="crest-img-sm" style="width:16px; height:16px;"> +${rav}</span>`);
                if (huf > 0) pills.push(`<span class="score-pill huf"><img src="/static/images/crest_hufflepuff.jpg" class="crest-img-sm" style="width:16px; height:16px;"> +${huf}</span>`);
                if (sly > 0) pills.push(`<span class="score-pill sly"><img src="/static/images/crest_slytherin.jpg" class="crest-img-sm" style="width:16px; height:16px;"> +${sly}</span>`);
                if (pills.length === 0) pills.push(`<span class="score-pill" style="color: var(--text-muted);">0 pts</span>`);

                return `
                    <div class="question-option-item">
                        <div class="option-text-main">
                            <strong>${markers[optIdx] || optIdx + 1}.</strong> ${this.escapeHtml(opt.text_en)}
                        </div>
                        <div class="option-text-de" style="color: var(--text-muted); font-size: 0.85rem;">${this.escapeHtml(opt.text_de)}</div>
                        <div class="score-badge-list">
                            ${pills.join("")}
                        </div>
                    </div>
                `;
            }).join("");

            return `
                <div class="question-card" data-question-id="${q.id}">
                    <div class="question-card-header">
                        <div class="question-number-badge">
                            ${badgeLabel} #${idx + 1}
                        </div>
                        <div class="question-card-actions">
                            <button type="button" class="btn-outline btn-edit-q" data-qid="${q.id}" style="padding: 4px 12px; font-size: 0.82rem;">
                                ✏️ ${editLabel}
                            </button>
                            <button type="button" class="btn-danger btn-delete-q" data-qid="${q.id}" style="padding: 4px 12px; font-size: 0.82rem;">
                                🗑️ ${deleteLabel}
                            </button>
                        </div>
                    </div>
                    <div class="question-texts-box">
                        <div class="question-text-row">🇬🇧 <strong>${this.escapeHtml(q.text_en)}</strong></div>
                        <div class="question-text-row de" style="color: #93c5fd; font-size: 0.9rem;">🇩🇪 ${this.escapeHtml(q.text_de)}</div>
                    </div>
                    <div class="question-options-preview">
                        ${optionsHtml}
                    </div>
                </div>
            `;
        }).join("");

        // Bind Edit & Delete buttons
        container.querySelectorAll(".btn-edit-q").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const qid = parseInt(e.currentTarget.getAttribute("data-qid"), 10);
                this.openEditQuestionModal(qid);
            });
        });

        container.querySelectorAll(".btn-delete-q").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const qid = parseInt(e.currentTarget.getAttribute("data-qid"), 10);
                this.deleteQuestion(qid);
            });
        });
    }

    renderOptionFormCards(optionsData = []) {
        const container = document.getElementById("options-form-container");
        if (!container) return;

        const markers = ["A", "B", "C", "D"];
        const defaultHouses = [
            { code: "GRY", name: "Gryffindor", crest: "/static/images/crest_gryffindor.jpg", class: "gry" },
            { code: "RAV", name: "Ravenclaw", crest: "/static/images/crest_ravenclaw.jpg", class: "rav" },
            { code: "HUF", name: "Hufflepuff", crest: "/static/images/crest_hufflepuff.jpg", class: "huf" },
            { code: "SLY", name: "Slytherin", crest: "/static/images/crest_slytherin.jpg", class: "sly" }
        ];

        let html = "";
        for (let i = 0; i < 4; i++) {
            const opt = optionsData[i] || { text_en: "", text_de: "", scores: {} };
            const optEn = opt.text_en || "";
            const optDe = opt.text_de || "";
            const scores = opt.scores || {};

            const scoreInputs = defaultHouses.map(h => {
                const scoreVal = scores[h.code] !== undefined ? scores[h.code] : (opt[`score_${h.code.toLowerCase()}`] || 0);
                return `
                    <div class="score-input-item ${h.class}">
                        <label><img src="${h.crest}" class="crest-img-sm" style="width:16px; height:16px; vertical-align:middle;"> ${h.name}</label>
                        <input type="number" class="score-input opt-score-${h.code.toLowerCase()}" data-house="${h.code}" min="0" max="10" value="${scoreVal}">
                    </div>
                `;
            }).join("");

            html += `
                <div class="option-form-card" data-opt-idx="${i}">
                    <div class="option-form-header">
                        <span>Option ${markers[i]}</span>
                    </div>
                    <div class="option-texts-grid">
                        <div class="form-group" style="width: 100%;">
                            <input type="text" class="search-input opt-text-en" placeholder="Option ${markers[i]} (English)..." value="${this.escapeHtml(optEn)}" required style="width: 100%;">
                        </div>
                        <div class="form-group" style="width: 100%;">
                            <input type="text" class="search-input opt-text-de" placeholder="Option ${markers[i]} (German)..." value="${this.escapeHtml(optDe)}" required style="width: 100%;">
                        </div>
                    </div>
                    <div class="score-inputs-grid">
                        ${scoreInputs}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    openAddQuestionModal() {
        document.getElementById("edit-question-id").value = "";
        document.getElementById("question-modal-title").textContent = window.i18n.t("modal_add_question_title") || "Add New Question";
        document.getElementById("q-text-en").value = "";
        document.getElementById("q-text-de").value = "";
        this.clearError("question-form-error");

        this.renderOptionFormCards([
            { text_en: "", text_de: "", scores: { GRY: 5, RAV: 0, HUF: 0, SLY: 0 } },
            { text_en: "", text_de: "", scores: { GRY: 0, RAV: 5, HUF: 0, SLY: 0 } },
            { text_en: "", text_de: "", scores: { GRY: 0, RAV: 0, HUF: 5, SLY: 0 } },
            { text_en: "", text_de: "", scores: { GRY: 0, RAV: 0, HUF: 0, SLY: 5 } }
        ]);

        this.showModal("modal-question");
    }

    openEditQuestionModal(questionId) {
        const q = this.questions.find(item => item.id === questionId);
        if (!q) return;

        document.getElementById("edit-question-id").value = q.id;
        document.getElementById("question-modal-title").textContent = window.i18n.t("modal_edit_question_title") || "Edit Question";
        document.getElementById("q-text-en").value = q.text_en || "";
        document.getElementById("q-text-de").value = q.text_de || "";
        this.clearError("question-form-error");

        this.renderOptionFormCards(q.options || []);
        this.showModal("modal-question");
    }

    async saveQuestion() {
        const editId = document.getElementById("edit-question-id").value;
        const textEn = document.getElementById("q-text-en").value.trim();
        const textDe = document.getElementById("q-text-de").value.trim();

        if (!textEn || !textDe) {
            this.showError("question-form-error", window.i18n.t("err_question_validation"));
            return;
        }

        const optionCards = document.querySelectorAll(".option-form-card");
        const options = [];

        for (const card of optionCards) {
            const optEnInput = card.querySelector(".opt-text-en");
            const optDeInput = card.querySelector(".opt-text-de");
            const optEn = optEnInput ? optEnInput.value.trim() : "";
            const optDe = optDeInput ? optDeInput.value.trim() : "";

            if (!optEn || !optDe) {
                this.showError("question-form-error", window.i18n.t("err_question_validation"));
                return;
            }

            const scores = {};
            const scoreInputs = card.querySelectorAll(".score-input");
            for (const input of scoreInputs) {
                const house = input.getAttribute("data-house");
                const pts = parseInt(input.value, 10) || 0;
                if (pts < 0 || pts > 10) {
                    this.showError("question-form-error", window.i18n.t("err_score_limit"));
                    return;
                }
                scores[house] = pts;
            }

            options.push({
                text_en: optEn,
                text_de: optDe,
                scores: scores
            });
        }

        const payload = {
            text_en: textEn,
            text_de: textDe,
            options: options
        };

        const saveBtn = document.getElementById("btn-save-question");
        if (saveBtn) saveBtn.disabled = true;

        try {
            const url = editId ? `/api/admin/questions/${editId}` : "/api/admin/questions";
            const method = editId ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: this.getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this.hideModal("modal-question");
                this.showToast(window.i18n.t("msg_question_saved") || "Question saved successfully!", "success");
                await this.loadQuestions();
            } else {
                const errData = await res.json();
                this.showError("question-form-error", errData.detail || "Failed to save question.");
            }
        } catch (err) {
            this.showError("question-form-error", "Network connection error.");
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    async deleteQuestion(questionId) {
        const isDe = window.i18n.getLang() === "de";
        const confirmed = await this.confirmDialog({
            icon: "🗑️",
            title: isDe ? "Frage löschen" : "Delete Question",
            message: window.i18n.t("confirm_delete_question") || (isDe ? "Möchtest du diese Frage wirklich löschen?" : "Are you sure you want to delete this question?"),
            confirmText: isDe ? "Löschen" : "Delete",
            isDanger: true
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/admin/questions/${questionId}`, {
                method: "DELETE",
                headers: this.getAuthHeaders()
            });
            if (res.ok) {
                this.showToast(window.i18n.t("msg_question_deleted") || (isDe ? "Frage gelöscht!" : "Question deleted!"), "success");
                await this.loadQuestions();
            } else {
                const errData = await res.json();
                this.showToast(errData.detail || (isDe ? "Fehler beim Löschen." : "Failed to delete question."), "error");
            }
        } catch (err) {
            this.showToast(isDe ? "Verbindungsfehler." : "Connection error while deleting question.", "error");
        }
    }

    openEditPointsModal(participantId) {
        const p = this.participants.find(item => item.id === participantId);
        if (!p) return;

        document.getElementById("edit-points-participant-id").value = p.id;
        document.getElementById("modal-edit-points-participant").textContent = 
            `Participant: ${p.display_name} (${p.house_name || 'Not sorted'})`;

        const houseSelect = document.getElementById("edit-points-house-id");
        const gamePtsInput = document.getElementById("edit-points-game-pts");
        const sortingScoreInput = document.getElementById("edit-points-sorting-score");
        const spellsCastInput = document.getElementById("edit-points-spells-cast");

        if (houseSelect) houseSelect.value = p.house_id || 1;
        if (gamePtsInput) gamePtsInput.value = p.spell_points_won || 0;
        if (sortingScoreInput) sortingScoreInput.value = p.total_score || 0;
        if (spellsCastInput) spellsCastInput.value = `${Math.min(p.spells_cast || 0, 2)}`;

        this.showModal("modal-edit-points");
    }

    adjustGamePoints(delta) {
        const input = document.getElementById("edit-points-game-pts");
        if (!input) return;
        let val = parseFloat(input.value) || 0;
        val = Math.max(0, val + delta);
        input.value = (val % 1 === 0) ? val : Number(val.toFixed(1));
    }

    async handleSaveEditPoints() {
        const id = parseInt(document.getElementById("edit-points-participant-id").value, 10);
        const houseId = parseInt(document.getElementById("edit-points-house-id").value, 10);
        const gamePts = parseFloat(document.getElementById("edit-points-game-pts").value) || 0;
        const sortingScore = parseInt(document.getElementById("edit-points-sorting-score").value, 10);
        const spellsCast = parseInt(document.getElementById("edit-points-spells-cast").value, 10);

        const btn = document.getElementById("btn-save-edit-points");
        if (btn) btn.disabled = true;

        try {
            const res = await fetch(`/api/admin/participants/${id}/points`, {
                method: "PATCH",
                headers: {
                    ...this.getAuthHeaders(),
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    house_id: isNaN(houseId) ? null : houseId,
                    game_points: gamePts,
                    sorting_score: isNaN(sortingScore) ? 0 : sortingScore,
                    spells_cast: isNaN(spellsCast) ? 0 : spellsCast
                })
            });

            if (res.ok) {
                this.hideModal("modal-edit-points");
                this.showToast(window.i18n.t("msg_points_updated"), "success");
                await this.loadParticipants();
            } else {
                const err = await res.json().catch(() => ({}));
                this.showToast(err.detail || "Failed to update points", "error");
            }
        } catch (e) {
            this.showToast("Connection error while updating points", "error");
        } finally {
            if (btn) btn.disabled = false;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.adminApp = new AdminApp();
});
