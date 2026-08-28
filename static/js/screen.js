// Public Projector Screen Controller (SSE + Animation Queue + Audio)

class PublicScreen {
    constructor() {
        this.eventSource = null;
        this.animationQueue = [];
        this.isProcessingQueue = false;
        this.housesData = {};

        this.init();
    }

    async init() {
        this.isDismissed = false;
        this.dismissCenterStage();
        this.bindEvents();
        this.bindLanguage();
        await this.loadInitialHouses();
        this.connectSSE();
    }

    bindEvents() {
        // Dismiss immediately on clicking close button, backdrop, or anywhere on screen
        const closeBtn = document.getElementById("btn-close-center-stage");
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.dismissCenterStage();
            });
        }

        const centerStage = document.getElementById("center-stage");
        if (centerStage) {
            centerStage.addEventListener("click", () => {
                this.dismissCenterStage();
            });
        }

        const pointsModal = document.getElementById("points-modal-stage");
        if (pointsModal) {
            pointsModal.addEventListener("click", () => {
                this.dismissPointsModal();
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === " ") {
                this.dismissCenterStage();
                this.dismissPointsModal();
            }
        });
    }

    dismissPointsModal() {
        if (this.pointsModalTimer) clearTimeout(this.pointsModalTimer);
        const modal = document.getElementById("points-modal-stage");
        if (modal) {
            modal.style.display = "none";
            modal.classList.add("hidden");
        }
    }

    dismissCenterStage() {
        this.isDismissed = true;
        const centerStage = document.getElementById("center-stage");
        if (centerStage) {
            centerStage.style.display = "none";
            centerStage.classList.add("hidden");
        }
        document.querySelectorAll(".flying-particle").forEach(p => p.remove());
        document.querySelectorAll(".house-zone").forEach(z => z.classList.remove("highlight-target"));
    }

    bindLanguage() {
        window.addEventListener("langchange", () => {
            this.updateHouseNames();
        });
    }

    async loadInitialHouses() {
        try {
            const lang = window.i18n.getLang();
            const res = await fetch(`/api/houses?lang=${lang}`);
            if (res.ok) {
                const houses = await res.json();
                houses.forEach(h => {
                    this.housesData[h.code] = h;
                    this.renderHouseRoster(h);
                });
            }
        } catch (e) {
            console.error("Failed to load initial houses", e);
        }
    }

    renderHouseRoster(house) {
        const counterEl = document.getElementById(`counter-${house.code}`);
        if (counterEl) {
            counterEl.textContent = `${house.total} 👥`;
        }

        const pointsEl = document.getElementById(`game-points-${house.code}`);
        if (pointsEl) {
            const ptsStr = (house.game_points % 1 === 0) ? house.game_points : Number(house.game_points).toFixed(1);
            pointsEl.textContent = `${ptsStr} 🏆`;
        }

        const listEl = document.getElementById(`list-${house.code}`);
        if (listEl) {
            listEl.innerHTML = "";
            (house.participants || []).forEach(p => {
                const li = document.createElement("li");
                li.className = "student-pill";
                li.setAttribute("data-participant-id", p.id);
                li.setAttribute("data-name", (p.display_name || "").trim().toLowerCase());
                li.innerHTML = `<span>✨</span> <span>${this.escapeHtml(p.display_name)}</span>`;
                listEl.appendChild(li);
            });
            listEl.scrollTop = listEl.scrollHeight;
        }
    }

    updateHouseNames() {
        const lang = window.i18n.getLang();
        document.querySelectorAll(".house-name").forEach(el => {
            const code = el.getAttribute("data-house");
            if (this.housesData[code]) {
                el.textContent = lang === "de" ? this.housesData[code].name_de || this.housesData[code].name : this.housesData[code].name_en || this.housesData[code].name;
            }
        });
    }

    connectSSE() {
        const statusEl = document.getElementById("connection-status");
        const statusText = document.getElementById("status-text");

        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource("/api/events/stream");

        this.eventSource.onopen = () => {
            if (statusEl) {
                statusEl.classList.remove("reconnecting");
                statusText.textContent = window.i18n.t("connected");
            }
        };

        this.eventSource.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (payload.type === "assignment") {
                    this.enqueueAssignment(payload.data);
                } else if (payload.type === "house_points_update") {
                    this.handleHousePointsUpdate(payload.data || payload);
                } else if (payload.type === "event_reset") {
                    // Reload all house data after admin reset
                    this.loadInitialHouses();
                }
            } catch (err) {
                console.error("SSE message parse error", err);
            }
        };

        this.eventSource.onerror = () => {
            if (statusEl) {
                statusEl.classList.add("reconnecting");
                statusText.textContent = window.i18n.t("reconnecting");
            }
            // EventSource will automatically retry connection
        };
    }

    handleHousePointsUpdate(data) {
        const ptsTotalStr = (data.total_game_points % 1 === 0) ? data.total_game_points : Number(data.total_game_points).toFixed(1);
        const pointsEl = document.getElementById(`game-points-${data.house_code}`);
        if (pointsEl) {
            pointsEl.textContent = `${ptsTotalStr} 🏆`;
            pointsEl.classList.add("pulse-points");
            setTimeout(() => pointsEl.classList.remove("pulse-points"), 1500);
        }

        const icons = { "GRY": "🦁", "RAV": "🦅", "HUF": "🦡", "SLY": "🐍" };
        const houseTheme = {
            "GRY": { border: "#e53e3e", glow: "rgba(229, 62, 62, 0.6)" },
            "RAV": { border: "#3182ce", glow: "rgba(49, 130, 206, 0.6)" },
            "HUF": { border: "#d69e2e", glow: "rgba(214, 158, 46, 0.6)" },
            "SLY": { border: "#38a169", glow: "rgba(56, 161, 105, 0.6)" }
        };

        const modalStage = document.getElementById("points-modal-stage");
        const modalCrest = document.getElementById("points-modal-crest");
        const modalAmount = document.getElementById("points-modal-amount");
        const modalTitle = document.getElementById("points-modal-title");
        const modalWizard = document.getElementById("points-modal-wizard");
        const modalCard = document.getElementById("points-modal-card");

        if (modalStage && modalCard) {
            const theme = houseTheme[data.house_code] || { border: "var(--gold-primary)", glow: "var(--gold-glow)" };
            modalCard.style.borderColor = theme.border;
            modalCard.style.boxShadow = `0 0 60px ${theme.glow}, 0 25px 50px rgba(0, 0, 0, 0.9)`;

            if (modalCrest) modalCrest.textContent = icons[data.house_code] || "✨";
            const ptsAwardStr = (data.awarded_points % 1 === 0) ? data.awarded_points : Number(data.awarded_points).toFixed(1);
            if (modalAmount) modalAmount.textContent = `+${ptsAwardStr} PTS`;
            if (modalTitle) modalTitle.textContent = `${data.house_name} Wins House Cup Points!`;
            if (modalWizard) modalWizard.textContent = `Cast by ${data.participant_name} ✨`;

            modalStage.style.display = "flex";
            modalStage.classList.remove("hidden");

            if (this.pointsModalTimer) clearTimeout(this.pointsModalTimer);
            this.pointsModalTimer = setTimeout(() => {
                this.dismissPointsModal();
            }, 3500);
        }

        this.playHouseFanfare();
    }

    enqueueAssignment(data) {
        this.animationQueue.push(data);
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.animationQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }

        this.isProcessingQueue = true;
        const assignment = this.animationQueue.shift();

        try {
            await this.playAssignmentAnimation(assignment);
        } catch (e) {
            console.error("Animation error", e);
        } finally {
            this.dismissCenterStage();
        }

        // Brief 600ms pause between queued animations (FR-12)
        await this.sleep(600);
        this.processQueue();
    }

    async playAssignmentAnimation(data) {
        this.isDismissed = false;
        const centerStage = document.getElementById("center-stage");
        const flyingName = document.getElementById("flying-name");
        const destination = document.getElementById("flying-destination");
        const hesitantBanner = document.getElementById("hesitant-banner");

        const lang = window.i18n.getLang();
        const houseName = (lang === "de" ? data.house_name_de : data.house_name_en) || data.house_code || "Hogwarts";

        // Backup timer to guarantee modal hides within 5 seconds regardless of what happens
        const backupTimer = setTimeout(() => {
            this.dismissCenterStage();
        }, 5000);

        try {
            // 1. Prepare center stage
            flyingName.textContent = data.display_name || "Wizard";
            destination.textContent = "";
            destination.style.color = data.color_hex || "#d3a625";

            if (data.is_hesitant) {
                hesitantBanner.classList.remove("hidden");
            } else {
                hesitantBanner.classList.add("hidden");
            }

            if (centerStage) {
                centerStage.style.display = "flex";
                centerStage.classList.remove("hidden");
            }
            this.playDrumroll();

            // 2. Suspense pause (1.5s - 2.2s if hesitant)
            const suspenseTime = data.is_hesitant ? 2200 : 1500;
            await this.sleep(suspenseTime);
            if (this.isDismissed) return;

            // 3. Reveal House Name shouting
            destination.textContent = `${houseName.toUpperCase()}!`;
            this.playHouseFanfare();
            await this.sleep(1200);
            if (this.isDismissed) return;

            // 4. Smooth flying transition into house column
            if (centerStage) {
                centerStage.style.display = "none";
                centerStage.classList.add("hidden");
            }
            await this.animateFlightToHouse(data, houseName);

            // 5. Update house column count & roster
            this.addParticipantToColumn(data);
        } finally {
            clearTimeout(backupTimer);
            if (centerStage) {
                centerStage.style.display = "none";
                centerStage.classList.add("hidden");
            }
        }
    }

    async animateFlightToHouse(data, houseName) {
        const targetZone = document.getElementById(`house-zone-${data.house_code}`);
        if (!targetZone) return;

        targetZone.classList.add("highlight-target");

        // Create flying particle
        const particle = document.createElement("div");
        particle.className = "flying-particle";
        particle.textContent = data.display_name;
        particle.style.borderColor = data.color_hex;
        particle.style.left = "50%";
        particle.style.top = "50%";
        particle.style.transform = "translate(-50%, -50%) scale(1.3)";
        document.body.appendChild(particle);

        await this.sleep(50);

        // Get target zone coordinates
        const rect = targetZone.getBoundingClientRect();
        const destX = rect.left + rect.width / 2;
        const destY = rect.top + 80;

        particle.style.left = `${destX}px`;
        particle.style.top = `${destY}px`;
        particle.style.transform = "translate(-50%, -50%) scale(0.7)";
        particle.style.opacity = "0.2";

        await this.sleep(1000);
        particle.remove();
        targetZone.classList.remove("highlight-target");
    }

    addParticipantToColumn(data) {
        const targetPid = String(data.participant_id);
        const targetName = (data.display_name || "").trim().toLowerCase();

        // 1. Remove participant from ANY house list where they currently exist
        document.querySelectorAll(".students-list").forEach(list => {
            list.querySelectorAll("li.student-pill").forEach(li => {
                const pid = li.getAttribute("data-participant-id");
                const name = li.getAttribute("data-name") || li.querySelector("span:last-child")?.textContent?.trim().toLowerCase();
                if ((pid && pid === targetPid) || (name && name === targetName)) {
                    li.remove();
                    // Decrement old house counter
                    const oldZone = list.closest(".house-zone");
                    if (oldZone) {
                        const oldCounter = oldZone.querySelector(".house-counter");
                        if (oldCounter) {
                            let count = Math.max(0, (parseInt(oldCounter.textContent, 10) || 1) - 1);
                            oldCounter.textContent = count;
                        }
                    }
                }
            });
        });

        // 2. Increment target house counter
        const counterEl = document.getElementById(`counter-${data.house_code}`);
        if (counterEl) {
            let count = parseInt(counterEl.textContent, 10) || 0;
            count++;
            counterEl.textContent = count;
            counterEl.classList.add("bump");
            setTimeout(() => counterEl.classList.remove("bump"), 500);
        }

        // 3. Add to target house list
        const listEl = document.getElementById(`list-${data.house_code}`);
        if (listEl) {
            const li = document.createElement("li");
            li.className = "student-pill recent";
            li.setAttribute("data-participant-id", data.participant_id);
            li.setAttribute("data-name", targetName);
            li.innerHTML = `<span>✨</span> <span>${this.escapeHtml(data.display_name)}</span>`;
            listEl.appendChild(li);
            listEl.scrollTop = listEl.scrollHeight;

            // Remove recent highlight after 6 seconds
            setTimeout(() => {
                li.classList.remove("recent");
            }, 6000);
        }

        // 4. Background synchronization with backend DB
        setTimeout(() => {
            this.loadInitialHouses();
        }, 1000);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    playDrumroll() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            for (let i = 0; i < 15; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(120 + Math.random() * 40, now + i * 0.09);
                gain.gain.setValueAtTime(0.06, now + i * 0.09);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.08);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.09);
                osc.stop(now + i * 0.09 + 0.08);
            }
        } catch (e) {}
    }

    playHouseFanfare() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
                gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.8);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + idx * 0.12);
                osc.stop(ctx.currentTime + idx * 0.12 + 0.8);
            });
        } catch (e) {}
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.screenApp = new PublicScreen();
});
