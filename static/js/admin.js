// Admin Dashboard Controller

class AdminApp {
    constructor() {
        this.token = this.getStoredToken();
        this.participants = [];
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

        // Modals Buttons
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
                this.loadParticipants();
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

        const crestIcons = { "GRY": "🦁", "RAV": "🦅", "HUF": "🦡", "SLY": "🐍" };

        list.forEach(p => {
            const tr = document.createElement("tr");

            const houseHtml = p.house_code 
                ? `<span class="house-tag ${p.house_code}">${crestIcons[p.house_code] || ''} ${p.house_name}</span>
                   ${p.manual_override ? `<span class="manual-badge">${window.i18n.t('badge_manual')}</span>` : ''}`
                : `<span style="color: var(--text-muted);">${window.i18n.t('not_sorted_yet')} (${p.answered_questions}/6)</span>`;

            tr.innerHTML = `
                <td>#${p.id}</td>
                <td><strong>${this.escapeHtml(p.display_name)}</strong></td>
                <td><span style="text-transform:uppercase; font-size:0.8rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">${p.preferred_lang || 'en'}</span></td>
                <td>${houseHtml}</td>
                <td>${p.total_score !== null && p.total_score !== undefined ? p.total_score + ' pts' : '—'}</td>
                <td>${p.assigned_at ? this.formatDateTime(p.assigned_at) : '—'}</td>
                <td class="actions-cell">
                    <button type="button" class="btn-outline small-btn" onclick="window.adminApp.openReassignModal(${p.id}, '${this.escapeHtml(p.display_name)}')">${window.i18n.t('btn_reassign')}</button>
                    <button type="button" class="btn-danger small-btn" onclick="window.adminApp.deleteParticipant(${p.id})">${window.i18n.t('btn_delete')}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
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
        document.getElementById("modal-reassign-participant").textContent = `Participant: ${name}`;

        // Compute current house occupancies
        const counts = { "GRY": 0, "RAV": 0, "HUF": 0, "SLY": 0 };
        this.participants.forEach(p => {
            if (p.house_code && counts[p.house_code] !== undefined) {
                counts[p.house_code]++;
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
                        initialUrl = info.guest_url;
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
                const qrInput = document.getElementById("qr-url-input");
                if (qrInput) {
                    qrInput.value = info.guest_url;
                }
                this.updateQrCode(info.guest_url);
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

                const crestIcons = { "GRY": "🦁", "RAV": "🦅", "HUF": "🦡", "SLY": "🐍" };

                let housesHtml = (data.house_distribution || []).map(h => {
                    const houseName = lang === "de" ? h.name_de : h.name_en;
                    const percent = data.total_assigned > 0 ? Math.round((h.total / data.total_assigned) * 100) : 0;
                    return `
                        <div class="stats-row">
                            <span>${crestIcons[h.code] || ''} <strong>${houseName}</strong></span>
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
                            <strong style="color: var(--gold-primary); font-size: 1.1rem;">${crestIcons[data.largest_house.code] || ''} ${lName} (${data.largest_house.total})</strong>
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

                container.innerHTML = `
                    <div class="stats-row" style="background: rgba(255, 255, 255, 0.05);">
                        <span>${lang === 'de' ? 'Registrierte Gäste' : 'Total Guests Registered'}:</span>
                        <strong>${data.total_participants}</strong>
                    </div>
                    <div class="stats-row" style="background: rgba(255, 255, 255, 0.05);">
                        <span>${lang === 'de' ? 'Zugeordnete Schüler' : 'Total Sorted Students'}:</span>
                        <strong>${data.total_assigned}</strong>
                    </div>
                    ${largestHouseHtml}
                    ${divisiveHtml}
                    ${incompleteHtml}
                    <h4 style="color: var(--gold-primary); margin-top: 10px; margin-bottom: 4px;">${lang === 'de' ? 'Hausverteilung' : 'House Distribution'}:</h4>
                    ${housesHtml}
                `;

                this.showModal("modal-stats");
            }
        } catch (e) {
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
    }

    hideAllModals() {
        document.querySelectorAll(".modal-overlay").forEach(m => {
            m.style.display = "none";
            m.classList.add("hidden");
        });
    }

    escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.adminApp = new AdminApp();
});
