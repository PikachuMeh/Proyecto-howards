import json
import sqlite3
from pathlib import Path
from app.database import get_db, init_db

HOUSES = [
    {
        "code": "GRY",
        "name_en": "Gryffindor",
        "name_de": "Gryffindor",
        "color_hex": "#740001",
        "secondary_color": "#D3A625",
        "motto_en": "Where dwell the brave at heart, their daring, nerve, and chivalry set them apart.",
        "motto_de": "Wo die Tapferen weilen, deren Mut, Kühnheit und Ritterlichkeit sie auszeichnen.",
        "crest_icon": "lion"
    },
    {
        "code": "RAV",
        "name_en": "Ravenclaw",
        "name_de": "Ravenclaw",
        "color_hex": "#0E1A40",
        "secondary_color": "#946B2D",
        "motto_en": "Wit beyond measure is man's greatest treasure.",
        "motto_de": "Unermesslicher Scharfsinn ist des Menschen größter Schatz.",
        "crest_icon": "eagle"
    },
    {
        "code": "HUF",
        "name_en": "Hufflepuff",
        "name_de": "Hufflepuff",
        "color_hex": "#ECB939",
        "secondary_color": "#372E29",
        "motto_en": "Where they are just and loyal, patient, true, and unafraid of toil.",
        "motto_de": "Wo sie gerecht und loyal sind, geduldig, treu und ohne Scheu vor harter Arbeit.",
        "crest_icon": "badger"
    },
    {
        "code": "SLY",
        "name_en": "Slytherin",
        "name_de": "Slytherin",
        "color_hex": "#1A472A",
        "secondary_color": "#5D5D5D",
        "motto_en": "Where cunning folk will use any means to achieve their ends.",
        "motto_de": "Wo listige Zauberer jedes Mittel nutzen, um ihre Ziele zu erreichen.",
        "crest_icon": "serpent"
    }
]

QUESTIONS_DATA = [
    {
        "position": 1,
        "text_en": "When faced with an unexpected obstacle during an adventure, what is your first instinct?",
        "text_de": "Wie ist dein erster Instinkt, wenn du bei einem Abenteuer auf ein unerwartetes Hindernis stößt?",
        "options": [
            {
                "position": 1,
                "text_en": "Charge forward headfirst without fear to overcome it directly.",
                "text_de": "Furchtlos und direkt voranstürmen, um es sofort zu überwinden.",
                "scores": {"GRY": 4, "RAV": 0, "HUF": 1, "SLY": 1}
            },
            {
                "position": 2,
                "text_en": "Analyze the patterns and find the most clever, logical solution.",
                "text_de": "Das Muster analysieren und die klügste, logischste Lösung finden.",
                "scores": {"GRY": 0, "RAV": 5, "HUF": 1, "SLY": 0}
            },
            {
                "position": 3,
                "text_en": "Gather your friends to make sure everyone is safe and work together.",
                "text_de": "Deine Freunde versammeln, um die Sicherheit aller zu gewährleisten und zusammenzuarbeiten.",
                "scores": {"GRY": 1, "RAV": 0, "HUF": 5, "SLY": 0}
            },
            {
                "position": 4,
                "text_en": "Find a clever shortcut or turn the obstacle to your personal advantage.",
                "text_de": "Eine schlaue Abkürzung finden oder das Hindernis zum eigenen Vorteil nutzen.",
                "scores": {"GRY": 0, "RAV": 1, "HUF": 0, "SLY": 5}
            }
        ]
    },
    {
        "position": 2,
        "text_en": "Which magical artifact would you most desire to hold in your hands?",
        "text_de": "Welches magische Artefakt würdest du am liebsten in deinen Händen halten?",
        "options": [
            {
                "position": 1,
                "text_en": "The Sword of Godric Gryffindor, appearing only to the truly courageous.",
                "text_de": "Das Schwert von Godric Gryffindor, das nur den wahrhaft Mutigen erscheint.",
                "scores": {"GRY": 5, "RAV": 0, "HUF": 1, "SLY": 0}
            },
            {
                "position": 2,
                "text_en": "Ravenclaw's Lost Diadem, granting boundless wisdom and insight.",
                "text_de": "Ravenclaws Diadem, das grenzenlose Weisheit und Erkenntnis verleiht.",
                "scores": {"GRY": 0, "RAV": 5, "HUF": 0, "SLY": 1}
            },
            {
                "position": 3,
                "text_en": "The Cup of Helga Hufflepuff, a symbol of hospitality, warmth, and sustenance.",
                "text_de": "Der Kelch von Helga Hufflepuff, ein Symbol für Gastfreundschaft, Wärme und Nahrung.",
                "scores": {"GRY": 0, "RAV": 1, "HUF": 5, "SLY": 0}
            },
            {
                "position": 4,
                "text_en": "The Resurrection Stone or the Elder Wand, conferring ultimate influence.",
                "text_de": "Der Stein der Auferstehung oder der Elderstab, der ultimative Macht verleiht.",
                "scores": {"GRY": 1, "RAV": 0, "HUF": 0, "SLY": 5}
            }
        ]
    },
    {
        "position": 3,
        "text_en": "At a grand holiday feast in the Great Hall, how do you spend your evening?",
        "text_de": "Wie verbringst du deinen Abend bei einem großen Festessen in der Großen Halle?",
        "options": [
            {
                "position": 1,
                "text_en": "Challenging your peers to daring festive pranks and heroic toasts.",
                "text_de": "Deine Mitschüler zu mutigen Feststreichen und heldenhaften Trinksprüchen herausfordern.",
                "scores": {"GRY": 5, "RAV": 0, "HUF": 1, "SLY": 0}
            },
            {
                "position": 2,
                "text_en": "Discussing fascinating magical theories and ancient folklore by the fire.",
                "text_de": "Am Kamin über faszinierende magische Theorien und alte Überlieferungen diskutieren.",
                "scores": {"GRY": 0, "RAV": 5, "HUF": 1, "SLY": 0}
            },
            {
                "position": 3,
                "text_en": "Sharing warm treats with everyone, making sure nobody feels left out.",
                "text_de": "Köstliche Leckereien mit allen teilen und dafür sorgen, dass sich niemand ausgeschlossen fühlt.",
                "scores": {"GRY": 1, "RAV": 0, "HUF": 5, "SLY": 0}
            },
            {
                "position": 4,
                "text_en": "Networking with influential professors and plotting your upcoming year's ambitions.",
                "text_de": "Kontakte zu einflussreichen Professoren knüpfen und Pläne für deine Ziele schmieden.",
                "scores": {"GRY": 0, "RAV": 1, "HUF": 0, "SLY": 5}
            }
        ]
    },
    {
        "position": 4,
        "text_en": "What quality do you value most deeply in a trusted friend?",
        "text_de": "Welche Eigenschaft schätzt du an einem vertrauten Freund am meisten?",
        "options": [
            {
                "position": 1,
                "text_en": "Bravery to stand up for justice even when it's dangerous.",
                "text_de": "Den Mut, für Gerechtigkeit einzustehen, selbst wenn es gefährlich ist.",
                "scores": {"GRY": 5, "RAV": 0, "HUF": 1, "SLY": 0}
            },
            {
                "position": 2,
                "text_en": "Originality, curious intellect, and thoughtful perspective.",
                "text_de": "Originalität, neugierigen Verstand und tiefgründige Perspektiven.",
                "scores": {"GRY": 0, "RAV": 5, "HUF": 1, "SLY": 0}
            },
            {
                "position": 3,
                "text_en": "Unconditional loyalty, honesty, and kindness in hard times.",
                "text_de": "Bedingungslose Loyalität, Ehrlichkeit und Herzensgüte in schweren Zeiten.",
                "scores": {"GRY": 1, "RAV": 0, "HUF": 5, "SLY": 0}
            },
            {
                "position": 4,
                "text_en": "Ambition, tactical shrewdness, and mutual determination to succeed.",
                "text_de": "Ehrgeiz, taktische Klugheit und die gemeinsame Entschlossenheit zum Erfolg.",
                "scores": {"GRY": 0, "RAV": 0, "HUF": 1, "SLY": 5}
            }
        ]
    },
    {
        "position": 5,
        "text_en": "You discover a hidden door in Hogwarts castle late at night. What makes you open it?",
        "text_de": "Du entdeckst spät in der Nacht eine geheime Tür im Schloss Hogwarts. Was bewegt dich dazu, sie zu öffnen?",
        "options": [
            {
                "position": 1,
                "text_en": "The thrilling rush of adventure and testing what lies in the unknown.",
                "text_de": "Der aufregende Reiz des Abenteuers und die Erkundung des Unbekannten.",
                "scores": {"GRY": 5, "RAV": 0, "HUF": 0, "SLY": 1}
            },
            {
                "position": 2,
                "text_en": "The prospect of unearthing forgotten spells, lost books, or secret knowledge.",
                "text_de": "Die Aussicht, vergessene Zaubersprüche, verlorene Bücher oder geheimes Wissen zu entdecken.",
                "scores": {"GRY": 0, "RAV": 5, "HUF": 0, "SLY": 1}
            },
            {
                "position": 3,
                "text_en": "Making sure the passageway is safe so other students won't get hurt.",
                "text_de": "Sicherzustellen, dass der Durchgang sicher ist, damit andere Schüler nicht in Gefahr geraten.",
                "scores": {"GRY": 1, "RAV": 0, "HUF": 5, "SLY": 0}
            },
            {
                "position": 4,
                "text_en": "Finding valuable treasures, power, or secrets to elevate your standing.",
                "text_de": "Wertvolle Schätze, Macht oder Geheimnisse zu finden, die deinen Status stärken.",
                "scores": {"GRY": 0, "RAV": 1, "HUF": 0, "SLY": 5}
            }
        ]
    },
    {
        "position": 6,
        "text_en": "How would you prefer history to remember your legacy at Hogwarts?",
        "text_de": "Wie möchtest du der Geschichte von Hogwarts in Erinnerung bleiben?",
        "options": [
            {
                "position": 1,
                "text_en": "As a hero who fought valiantly for what is right.",
                "text_de": "Als ein Held, der tapfer für das Richtige gekämpft hat.",
                "scores": {"GRY": 5, "RAV": 0, "HUF": 1, "SLY": 0}
            },
            {
                "position": 2,
                "text_en": "As an enlightened scholar whose discoveries expanded the horizons of magic.",
                "text_de": "Als ein weiser Gelehrter, dessen Entdeckungen die Grenzen der Magie erweitert haben.",
                "scores": {"GRY": 0, "RAV": 5, "HUF": 0, "SLY": 1}
            },
            {
                "position": 3,
                "text_en": "As a faithful, warm-hearted friend who brought people together in harmony.",
                "text_de": "Als ein treuer, warmherziger Freund, der Menschen in Eintracht zusammengebracht hat.",
                "scores": {"GRY": 1, "RAV": 0, "HUF": 5, "SLY": 0}
            },
            {
                "position": 4,
                "text_en": "As a legendary and formidable leader who achieved greatness.",
                "text_de": "Als eine legendäre und einflussreiche Führungspersönlichkeit, die Großes vollbracht hat.",
                "scores": {"GRY": 0, "RAV": 0, "HUF": 0, "SLY": 5}
            }
        ]
    }
]

def seed_database(db_path: Path = None):
    """Initializes and seeds default houses and questions if not already present."""
    init_db(db_path)
    with get_db(db_path) as conn:
        # 1. Event
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM event WHERE active = 1 LIMIT 1")
        row = cursor.fetchone()
        if not row:
            cursor.execute("INSERT INTO event (name, active, balancing_mode) VALUES (?, 1, 0)", ("Hogwarts Christmas Party",))
            event_id = cursor.lastrowid
        else:
            event_id = row["id"]

        # 2. Houses
        house_id_map = {}
        for h in HOUSES:
            cursor.execute("SELECT id FROM house WHERE code = ?", (h["code"],))
            h_row = cursor.fetchone()
            if not h_row:
                cursor.execute("""
                    INSERT INTO house (code, name_en, name_de, color_hex, secondary_color, motto_en, motto_de, crest_icon)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    h["code"], h["name_en"], h["name_de"], h["color_hex"],
                    h["secondary_color"], h["motto_en"], h["motto_de"], h["crest_icon"]
                ))
                house_id = cursor.lastrowid
            else:
                house_id = h_row["id"]
            house_id_map[h["code"]] = house_id

        # 3. Questions & Options & Scores
        cursor.execute("SELECT COUNT(*) as cnt FROM question WHERE event_id = ?", (event_id,))
        q_count = cursor.fetchone()["cnt"]
        if q_count == 0:
            for q_data in QUESTIONS_DATA:
                cursor.execute("""
                    INSERT INTO question (event_id, text_en, text_de, position)
                    VALUES (?, ?, ?, ?)
                """, (event_id, q_data["text_en"], q_data["text_de"], q_data["position"]))
                question_id = cursor.lastrowid

                for opt_data in q_data["options"]:
                    cursor.execute("""
                        INSERT INTO option (question_id, text_en, text_de, position)
                        VALUES (?, ?, ?, ?)
                    """, (question_id, opt_data["text_en"], opt_data["text_de"], opt_data["position"]))
                    option_id = cursor.lastrowid

                    for house_code, pts in opt_data["scores"].items():
                        h_id = house_id_map[house_code]
                        cursor.execute("""
                            INSERT INTO option_score (option_id, house_id, points)
                            VALUES (?, ?, ?)
                        """, (option_id, h_id, pts))

        # 4. Administrators
        from app.auth import hash_password
        ADMINS = [
            {
                "username": "admin",
                "password": "alohomora",
                "full_name": "Prof. Albus Dumbledore",
                "role": "Headmaster"
            },
            {
                "username": "mcgonagall",
                "password": "transfiguration",
                "full_name": "Prof. Minerva McGonagall",
                "role": "Deputy Headmistress"
            }
        ]
        for adm in ADMINS:
            cursor.execute("SELECT id FROM administrator WHERE username = ?", (adm["username"],))
            if not cursor.fetchone():
                pwd_hash = hash_password(adm["password"])
                cursor.execute("""
                    INSERT INTO administrator (username, password_hash, full_name, role)
                    VALUES (?, ?, ?, ?)
                """, (adm["username"], pwd_hash, adm["full_name"], adm["role"]))

    print("Database successfully seeded with bilingual Hogwarts data and administrator accounts.")

if __name__ == "__main__":
    seed_database()
