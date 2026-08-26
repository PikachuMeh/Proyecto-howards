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
        this.bindLanguage();
        await this.loadInitialHouses();
        this.connectSSE();
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
            counterEl.textContent = house.total;
        }

        const listEl = document.getElementById(`list-${house.code}`);
        if (listEl) {
            listEl.innerHTML = "";
            (house.participants || []).forEach(p => {
                const li = document.createElement("li");
                li.className = "student-pill";
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
        }

        // Brief 600ms pause between queued animations (FR-12)
        await this.sleep(600);
        this.processQueue();
    }

    async playAssignmentAnimation(data) {
        const centerStage = document.getElementById("center-stage");
        const flyingName = document.getElementById("flying-name");
        const destination = document.getElementById("flying-destination");
        const hesitantBanner = document.getElementById("hesitant-banner");

        const lang = window.i18n.getLang();
        const houseName = lang === "de" ? data.house_name_de : data.house_name_en;

        // 1. Prepare center stage
        flyingName.textContent = data.display_name;
        destination.textContent = "";
        destination.style.color = data.color_hex;

        if (data.is_hesitant) {
            hesitantBanner.classList.remove("hidden");
        } else {
            hesitantBanner.classList.add("hidden");
        }

        centerStage.classList.remove("hidden");
        this.playDrumroll();

        // 2. Suspense pause (1.5s - 2.2s if hesitant)
        const suspenseTime = data.is_hesitant ? 2200 : 1500;
        await this.sleep(suspenseTime);

        // 3. Reveal House Name shouting
        destination.textContent = `${houseName.toUpperCase()}!`;
        this.playHouseFanfare();
        await this.sleep(1200);

        // 4. Smooth flying transition into house column
        centerStage.classList.add("hidden");
        await this.animateFlightToHouse(data, houseName);

        // 5. Update house column count & roster
        this.addParticipantToColumn(data);
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
        const counterEl = document.getElementById(`counter-${data.house_code}`);
        if (counterEl) {
            let count = parseInt(counterEl.textContent, 10) || 0;
            count++;
            counterEl.textContent = count;
            counterEl.classList.add("bump");
            setTimeout(() => counterEl.classList.remove("bump"), 500);
        }

        const listEl = document.getElementById(`list-${data.house_code}`);
        if (listEl) {
            const li = document.createElement("li");
            li.className = "student-pill recent";
            li.innerHTML = `<span>✨</span> <span>${this.escapeHtml(data.display_name)}</span>`;
            listEl.appendChild(li);
            listEl.scrollTop = listEl.scrollHeight;

            // Remove recent highlight after 6 seconds
            setTimeout(() => {
                li.classList.remove("recent");
            }, 6000);
        }
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
