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

        const prophetModal = document.getElementById("modal-prophet-announcement");
        if (prophetModal) {
            prophetModal.addEventListener("click", () => {
                this.dismissProphetModal();
            });
        }

        const fullscreenBtn = document.getElementById("btn-toggle-fullscreen");
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener("click", () => {
                this.toggleFullscreen();
            });
        }

        const resetBtn = document.getElementById("btn-screen-reset");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                window.location.href = "/admin";
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === " ") {
                this.dismissCenterStage();
                this.dismissPointsModal();
                this.dismissProphetModal();
            } else if (e.key === "f" || e.key === "F") {
                this.toggleFullscreen();
            }
        });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }

    dismissPointsModal() {
        if (this.pointsModalTimer) clearTimeout(this.pointsModalTimer);
        const modal = document.getElementById("points-modal-stage");
        if (modal) {
            modal.style.display = "none";
            modal.classList.add("hidden");
        }
    }

    dismissProphetModal() {
        const modal = document.getElementById("modal-prophet-announcement");
        if (modal) {
            modal.style.display = "none";
            modal.classList.add("hidden");
        }
    }

    dismissCenterStage() {
        this.isDismissed = true;
        this.dismissProphetModal();
        const centerStage = document.getElementById("center-stage");
        if (centerStage) {
            centerStage.style.display = "none";
            centerStage.classList.add("hidden");
        }
        document.querySelectorAll(".flying-particle").forEach(p => p.remove());
        document.querySelectorAll(".gothic-arch-window").forEach(z => z.classList.remove("highlight-target"));
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
                let totalStudents = 0;
                houses.forEach(h => {
                    this.housesData[h.code] = h;
                    this.renderHouseRoster(h);
                    totalStudents += (h.total || 0);
                    
                    const sideCount = document.getElementById(`sidebar-count-${h.code}`);
                    if (sideCount) sideCount.textContent = h.total || 0;
                });

                const sideTotal = document.getElementById("sidebar-count-TOTAL");
                if (sideTotal) sideTotal.textContent = totalStudents;
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

        const pointsEl = document.getElementById(`game-points-${house.code}`);
        if (pointsEl) {
            const ptsStr = (house.game_points % 1 === 0) ? house.game_points : Number(house.game_points).toFixed(1);
            pointsEl.textContent = `🏆 ${ptsStr} pts`;
        }

        const listEl = document.getElementById(`list-${house.code}`);
        if (listEl) {
            listEl.innerHTML = "";
            (house.participants || []).forEach(p => {
                const li = document.createElement("li");
                li.className = "arch-student-item";
                li.setAttribute("data-participant-id", p.id);
                li.setAttribute("data-name", (p.display_name || "").trim().toLowerCase());
                li.innerHTML = `<span class="student-sparkle">✦</span> <span>${this.escapeHtml(p.display_name)}</span>`;
                listEl.appendChild(li);
            });
            listEl.scrollTop = listEl.scrollHeight;
        }
    }

    updateHouseNames() {
        const lang = window.i18n.getLang();
        document.querySelectorAll(".arch-house-banner").forEach(el => {
            const windowEl = el.closest(".gothic-arch-window");
            if (!windowEl) return;
            const code = windowEl.id.replace("house-zone-", "");
            if (this.housesData[code]) {
                el.textContent = (lang === "de" ? this.housesData[code].name_de || this.housesData[code].name : this.housesData[code].name_en || this.housesData[code].name).toUpperCase();
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
        };
    }

    handleHousePointsUpdate(data) {
        const ptsTotalStr = (data.total_game_points % 1 === 0) ? data.total_game_points : Number(data.total_game_points).toFixed(1);
        const pointsEl = document.getElementById(`game-points-${data.house_code}`);
        if (pointsEl) {
            pointsEl.textContent = `🏆 ${ptsTotalStr} pts`;
            pointsEl.classList.add("pulse-points");
            setTimeout(() => pointsEl.classList.remove("pulse-points"), 1500);
        }

        const crestMap = {
            "GRY": "/static/images/crest_gryffindor.jpg",
            "SLY": "/static/images/crest_slytherin.jpg",
            "RAV": "/static/images/crest_ravenclaw.jpg",
            "HUF": "/static/images/crest_hufflepuff.jpg"
        };

        const modalStage = document.getElementById("points-modal-stage");
        const modalCrestImg = document.getElementById("points-modal-crest-img");
        const modalAmount = document.getElementById("points-modal-amount");
        const modalTitle = document.getElementById("points-modal-title");
        const modalWizard = document.getElementById("points-modal-wizard");
        const modalCard = document.getElementById("points-modal-card");

        if (modalStage && modalCard && data.awarded_points > 0) {
            if (modalCrestImg) {
                modalCrestImg.src = crestMap[data.house_code] || "/static/images/crest_gryffindor.jpg";
            }
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

        // Pause between queued animations
        await this.sleep(600);
        this.processQueue();
    }

    async playAssignmentAnimation(data) {
        this.isDismissed = false;
        const centerStage = document.getElementById("center-stage");
        const flyingName = document.getElementById("flying-name");
        const destination = document.getElementById("flying-destination");
        const destCrest = document.getElementById("flying-dest-crest");
        const destName = document.getElementById("flying-dest-name");
        const hesitantBanner = document.getElementById("hesitant-banner");

        const prophetModal = document.getElementById("modal-prophet-announcement");
        const prophetStudentName = document.getElementById("prophet-student-name");
        const prophetHouseBadge = document.getElementById("prophet-house-badge");
        const prophetWizardImg = document.getElementById("prophet-wizard-img");
        const prophetPhotoCaption = document.getElementById("prophet-photo-caption");
        const prophetMottoText = document.getElementById("prophet-motto-text");

        const crestMap = {
            "GRY": "/static/images/crest_gryffindor.jpg",
            "SLY": "/static/images/crest_slytherin.jpg",
            "RAV": "/static/images/crest_ravenclaw.jpg",
            "HUF": "/static/images/crest_hufflepuff.jpg"
        };

        const famousWizards = {
            "en": {
                "GRY": {
                    name: "Prof. Albus Dumbledore",
                    motto: "Where dwell the brave at heart, their daring, nerve, and chivalry set Gryffindors apart.",
                    img: "/static/images/wizard_gryffindor.jpg"
                },
                "SLY": {
                    name: "Prof. Severus Snape",
                    motto: "Cunning folk use any means to achieve their ends; here great ambition finds its true path.",
                    img: "/static/images/wizard_slytherin.jpg"
                },
                "RAV": {
                    name: "Luna Lovegood",
                    motto: "Wit beyond measure is man's greatest treasure; home of the wise and brilliant.",
                    img: "/static/images/wizard_ravenclaw.jpg"
                },
                "HUF": {
                    name: "Newt Scamander",
                    motto: "Where they are just and loyal; those patient Hufflepuffs are true and unafraid of toil.",
                    img: "/static/images/wizard_hufflepuff.jpg"
                }
            },
            "de": {
                "GRY": {
                    name: "Prof. Albus Dumbledore",
                    motto: "Dort, wo der Mut im Herzen wohnt, zeichnet Entschlossenheit und Ritterlichkeit die Gryffindors aus.",
                    img: "/static/images/wizard_gryffindor.jpg"
                },
                "SLY": {
                    name: "Prof. Severus Snape",
                    motto: "Schlaue Köpfe nutzen jedes Mittel, um ans Ziel zu gelangen; hier findet großer Ehrgeiz seinen Weg.",
                    img: "/static/images/wizard_slytherin.jpg"
                },
                "RAV": {
                    name: "Luna Lovegood",
                    motto: "Gelehrsamkeit ohne Grenzen ist des Menschen größter Schatz; Heimat der Klugen und Scharfsinnigen.",
                    img: "/static/images/wizard_ravenclaw.jpg"
                },
                "HUF": {
                    name: "Newt Scamander",
                    motto: "Wo Gerechtigkeit und Loyalität wohnen; geduldige Hufflepuffs sind wahrhaftig und scheuen keine Mühe.",
                    img: "/static/images/wizard_hufflepuff.jpg"
                }
            }
        };

        const currentLang = window.i18n.getLang() === "de" ? "de" : "en";
        const houseName = (currentLang === "de" ? data.house_name_de : data.house_name_en) || data.house_code || "Hogwarts";
        const houseCode = data.house_code || "GRY";
        const wizard = (famousWizards[currentLang] && famousWizards[currentLang][houseCode]) || famousWizards["en"]["GRY"];

        // Backup timer to guarantee modal hides within 8 seconds
        const backupTimer = setTimeout(() => {
            this.dismissCenterStage();
        }, 8000);

        try {
            // 1. Prepare center stage
            flyingName.textContent = data.display_name || "Wizard";
            if (destCrest) destCrest.src = crestMap[data.house_code] || "/static/images/crest_gryffindor.jpg";
            if (destName) destName.textContent = houseName.toUpperCase();

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

            // 2. Suspense pause
            const suspenseTime = data.is_hesitant ? 1800 : 1200;
            await this.sleep(suspenseTime);
            if (this.isDismissed) return;

            // 3. Hide center stage & Pop Daily Prophet Announcement!
            if (centerStage) {
                centerStage.style.display = "none";
                centerStage.classList.add("hidden");
            }

            if (prophetModal && prophetStudentName) {
                window.i18n.applyTranslations();
                prophetStudentName.textContent = (data.display_name || "Wizard").toUpperCase();
                if (prophetHouseBadge) {
                    prophetHouseBadge.textContent = `${houseName.toUpperCase()}`;
                    prophetHouseBadge.className = `prophet-house-name ${houseCode}`;
                }
                if (prophetWizardImg) prophetWizardImg.src = wizard.img;
                if (prophetPhotoCaption) prophetPhotoCaption.textContent = window.i18n.t("prophet_welcome_caption", { name: wizard.name });
                if (prophetMottoText) prophetMottoText.textContent = `"${wizard.motto}"`;

                prophetModal.style.display = "flex";
                prophetModal.classList.remove("hidden");
                this.playHouseFanfare();

                await this.sleep(3400);
                if (this.isDismissed) return;

                prophetModal.style.display = "none";
                prophetModal.classList.add("hidden");
            }

            // 4. Smooth flying transition into house column
            await this.animateFlightToHouse(data, houseName);

            // 5. Update house column count & roster & sidebar widgets
            this.addParticipantToColumn(data);
            this.updateLatestMemberWidget(data, houseName);
        } finally {
            clearTimeout(backupTimer);
            if (centerStage) {
                centerStage.style.display = "none";
                centerStage.classList.add("hidden");
            }
            if (prophetModal) {
                prophetModal.style.display = "none";
                prophetModal.classList.add("hidden");
            }
        }
    }

    updateLatestMemberWidget(data, houseName) {
        const crestMap = {
            "GRY": "/static/images/crest_gryffindor.jpg",
            "SLY": "/static/images/crest_slytherin.jpg",
            "RAV": "/static/images/crest_ravenclaw.jpg",
            "HUF": "/static/images/crest_hufflepuff.jpg"
        };
        const latestCrest = document.getElementById("latest-member-crest");
        const latestName = document.getElementById("latest-member-name");
        const latestHouse = document.getElementById("latest-member-house");

        if (latestCrest) latestCrest.src = crestMap[data.house_code] || "/static/images/crest_gryffindor.jpg";
        if (latestName) latestName.textContent = data.display_name;
        if (latestHouse) latestHouse.textContent = houseName.toUpperCase();
    }

    async animateFlightToHouse(data, houseName) {
        const targetZone = document.getElementById(`house-zone-${data.house_code}`);
        if (!targetZone) return;

        targetZone.classList.add("highlight-target");

        // Create flying particle
        const particle = document.createElement("div");
        particle.className = "flying-particle";
        particle.textContent = data.display_name;
        particle.style.borderColor = data.color_hex || "var(--gold-primary)";
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
        document.querySelectorAll(".arch-students-list").forEach(list => {
            list.querySelectorAll("li.arch-student-item").forEach(li => {
                const pid = li.getAttribute("data-participant-id");
                const name = li.getAttribute("data-name") || li.querySelector("span:last-child")?.textContent?.trim().toLowerCase();
                if ((pid && pid === targetPid) || (name && name === targetName)) {
                    li.remove();
                    const oldZone = list.closest(".gothic-arch-window");
                    if (oldZone) {
                        const oldCounter = oldZone.querySelector(".counter-number");
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
        }

        // 3. Add to target house list
        const listEl = document.getElementById(`list-${data.house_code}`);
        if (listEl) {
            const li = document.createElement("li");
            li.className = "arch-student-item newly-added";
            li.setAttribute("data-participant-id", data.participant_id);
            li.setAttribute("data-name", targetName);
            li.innerHTML = `<span class="student-sparkle">✦</span> <span>${this.escapeHtml(data.display_name)}</span>`;
            listEl.appendChild(li);
            listEl.scrollTop = listEl.scrollHeight;

            setTimeout(() => {
                li.classList.remove("newly-added");
            }, 5000);
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
            const notes = [440, 554.37, 659.25, 880];
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
