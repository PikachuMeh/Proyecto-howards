// Admin Dashboard Controller

class AdminApp {
    constructor() {
        this.token = sessionStorage.getItem("admin_token") || null;
        this.participants = [];
        this.selectedParticipantId = null;

        this.init();
    }

    init() {
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

        // Search roster
        const searchInput = document.getElementById("roster-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => this.filterRoster(e.target.value));
        }

        // Action Toolbar
        document.getElementById("btn-reset-event").addEventListener("click", () => this.handleResetEvent());
        document.getElementById("btn-export-csv").addEventListener("click", () => this.handleExportCsv());
        document.getElementById("btn-show-qr").addEventListener("click", () => this.handleShowQr());
        document.getElementById("btn-closing-stats").addEventListener("click", () => this.handleShowStats());

        // Modals
        document.getElementById("btn-cancel-reassign").addEventListener("click", () => this.hideModal("modal-reassign"));
        document.getElementById("btn-save-reassign").addEventListener("click", () => this.saveReassignment());
        document.getElementById("btn-close-qr").addEventListener("click", () => this.hideModal("modal-qr"));
        document.getElementById("btn-close-stats").addEventListener("click", () => this.hideModal("modal-stats"));

        // Language change event
        window.addEventListener("langchange", () => {
            if (this.token) {
                this.loadParticipants();
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
        try {
            const res = await fetch("/api/admin/me", { headers: this.getAuthHeaders() });
            if (res.ok) {
                const admin = await res.json();
                const badge = document.getElementById("admin-user-badge");
                const nameEl = document.getElementById("admin-user-name");
                const roleEl = document.getElementById("admin-user-role");
                if (badge && nameEl && roleEl) {
                    nameEl.textContent = admin.full_name || admin.username;
                    roleEl.textContent = admin.role || "Headmaster";
                    badge.classList.remove("hidden");
                }
            } else if (res.status === 401) {
                this.handleLogout();
            }
        } catch (e) {
            console.error("Failed to load admin profile", e);
        }
    }

    async handleLogin() {
        const usernameInput = document.getElementById("admin-username");
        const username = usernameInput ? usernameInput.value.trim() : "admin";
        const pwd = document.getElementById("admin-password").value;
        const errEl = document.getElementById("login-error");
        errEl.classList.add("hidden");

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username, password: pwd })
            });

            if (res.ok) {
                const data = await res.json();
                this.token = data.token;
                sessionStorage.setItem("admin_token", data.token);
                await this.showDashboard();
            } else {
                const errData = await res.json().catch(() => ({}));
                errEl.textContent = errData.detail || "Invalid username or secret spell. Access denied.";
                errEl.classList.remove("hidden");
            }
        } catch (e) {
            errEl.textContent = "Connection error.";
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
        sessionStorage.removeItem("admin_token");
        this.showLogin();
    }

    getAuthHeaders() {
        return {
            "Content-Type": "application/json",
            "X-Admin-Token": this.token || ""
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
        try {
            const lang = window.i18n.getLang();
            const res = await fetch(`/api/admin/participants?lang=${lang}`, { headers: this.getAuthHeaders() });
            if (res.ok) {
                this.participants = await res.json();
                this.renderRoster(this.participants);
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

    renderRoster(list) {
        const tbody = document.getElementById("roster-tbody");
        tbody.innerHTML = "";

        if (list.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">No participants found.</td>`;
            tbody.appendChild(tr);
            return;
        }

        const crestIcons = { "GRY": "🦁", "RAV": "🦅", "HUF": "🦡", "SLY": "🐍" };

        list.forEach(p => {
            const tr = document.createElement("tr");

            const houseHtml = p.house_code 
                ? `<span class="house-tag ${p.house_code}">${crestIcons[p.house_code] || ''} ${p.house_name}</span>
                   ${p.manual_override ? '<span class="manual-badge">Manual</span>' : ''}`
                : `<span style="color: var(--text-muted);">${window.i18n.t('not_sorted_yet')} (${p.answered_questions}/6)</span>`;

            tr.innerHTML = `
                <td>#${p.id}</td>
                <td><strong>${this.escapeHtml(p.display_name)}</strong></td>
                <td><span style="text-transform:uppercase; font-size:0.8rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">${p.preferred_lang || 'en'}</span></td>
                <td>${houseHtml}</td>
                <td>${p.total_score !== null && p.total_score !== undefined ? p.total_score + ' pts' : '—'}</td>
                <td>${p.assigned_at ? new Date(p.assigned_at).toLocaleTimeString() : '—'}</td>
                <td class="actions-cell">
                    <button type="button" class="btn-outline small-btn" onclick="window.adminApp.openReassignModal(${p.id}, '${this.escapeHtml(p.display_name)}')">${window.i18n.t('btn_reassign')}</button>
                    <button type="button" class="btn-danger small-btn" onclick="window.adminApp.deleteParticipant(${p.id})">${window.i18n.t('btn_delete')}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    filterRoster(query) {
        const q = query.toLowerCase().trim();
        const filtered = this.participants.filter(p => p.display_name.toLowerCase().includes(q));
        this.renderRoster(filtered);
    }

    openReassignModal(participantId, name) {
        this.selectedParticipantId = participantId;
        document.getElementById("modal-reassign-participant").textContent = `Participant: ${name}`;
        this.showModal("modal-reassign");
    }

    async saveReassignment() {
        const selectedRadio = document.querySelector('input[name="reassign-house"]:checked');
        if (!selectedRadio) {
            alert("Please choose a house.");
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
            } else {
                alert("Reassignment failed.");
            }
        } catch (e) {
            alert("Network error.");
        }
    }

    async deleteParticipant(participantId) {
        if (!confirm(window.i18n.t("confirm_delete"))) return;

        try {
            const res = await fetch(`/api/admin/participants/${participantId}`, {
                method: "DELETE",
                headers: this.getAuthHeaders()
            });

            if (res.ok) {
                await this.loadParticipants();
            } else {
                alert("Deletion failed.");
            }
        } catch (e) {
            alert("Network error.");
        }
    }

    async handleResetEvent() {
        if (!confirm(window.i18n.t("confirm_reset"))) return;

        try {
            const res = await fetch("/api/admin/event/reset", {
                method: "POST",
                headers: this.getAuthHeaders()
            });

            if (res.ok) {
                alert("Event has been reset.");
                await this.loadParticipants();
            } else {
                alert("Reset failed.");
            }
        } catch (e) {
            alert("Network error.");
        }
    }

    handleExportCsv() {
        window.location.href = `/api/admin/export/csv?auth_token=${this.token}`;
    }

    handleShowQr() {
        const guestUrl = `${window.location.origin}/`;
        document.getElementById("qr-url-text").textContent = guestUrl;
        
        // Generate QR code using public dynamic QR API
        const qrImg = document.getElementById("qr-img");
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(guestUrl)}`;

        this.showModal("modal-qr");
    }

    async handleShowStats() {
        try {
            const res = await fetch("/api/admin/stats", { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const container = document.getElementById("stats-content");
                const lang = window.i18n.getLang();

                let housesHtml = (data.house_distribution || []).map(h => `
                    <div class="stats-row">
                        <span>${h.name_en} / ${h.name_de}</span>
                        <strong>${h.total} students</strong>
                    </div>
                `).join("");

                container.innerHTML = `
                    <div class="stats-row" style="background: rgba(245, 197, 24, 0.15);">
                        <span>Total Guests Registered:</span>
                        <strong>${data.total_participants}</strong>
                    </div>
                    <div class="stats-row" style="background: rgba(245, 197, 24, 0.15);">
                        <span>Total Sorted Students:</span>
                        <strong>${data.total_assigned}</strong>
                    </div>
                    <h4 style="color: var(--gold-primary); margin-top: 10px;">House Distribution:</h4>
                    ${housesHtml}
                `;

                this.showModal("modal-stats");
            }
        } catch (e) {
            alert("Failed to load statistics.");
        }
    }

    showModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.remove("hidden");
    }

    hideModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.add("hidden");
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
