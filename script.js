// ========================================================
// HealthOps PK — order capture (Supabase) + WhatsApp routing
// ========================================================

const OFFICIAL_WHATSAPP_NUMBER = "923042917388";

// Supabase project (public anon key — insert-only, RLS protected)
const SUPABASE_URL = "https://iheerbgatusywlqoejeg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloZWVyYmdhdHVzeXdscW9lamVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1Mjk0NjcsImV4cCI6MjEwOTEwNTQ2N30.hGz1ffyZyD00W8MfvaZYK4NBXmBRSi-07LP1olxMBeg";

const ORDERS_ENDPOINT = SUPABASE_URL + "/rest/v1/orders";
const QUEUE_KEY = "healthops_pending_orders";

// 1. Product → price lookup (PKR)
function priceForProduct(productText) {
    const match = /Rs\.?\s*([\d,]+)/.exec(productText || "");
    return match ? parseInt(match[1].replace(/,/g, ""), 10) : null;
}

// 2. Select product from a pricing card
function selectProductInForm(productName) {
    const selectElem = document.getElementById("productSelect");
    if (selectElem) {
        selectElem.value = productName;
    }
    const formSection = document.getElementById("order-form-section");
    if (formSection) {
        formSection.scrollIntoView({ behavior: "smooth" });
    }
}

// 3. Copy to clipboard
function copyText(elementId) {
    const elem = document.getElementById(elementId);
    if (!elem) return;
    const text = elem.innerText.trim();
    navigator.clipboard.writeText(text).then(() => {
        const btn = elem.nextElementSibling;
        if (btn && btn.classList.contains("btn-copy")) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 2000);
        }
    }).catch(err => {
        console.error("Copy failed", err);
    });
}

// 4. Pre-filled WhatsApp message
function buildOrderMessage(order) {
    let waText = "*Salam HealthOps Pakistan! Naya Order Submission:*\n\n";
    waText += "Doctor / Owner: " + order.name + "\n";
    waText += "Clinic / Hospital: " + order.clinic + "\n";
    waText += "City: " + order.city + "\n";
    waText += "WhatsApp: " + order.whatsapp + "\n";
    waText += "Selected Package: " + order.product + "\n";
    waText += "Preferred Payment: " + order.payment_method + "\n";
    if (order.notes) {
        waText += "Notes: " + order.notes + "\n";
    }
    waText += "\nOrder ID: " + order._orderId;
    waText += "\n\nKindly payment details share karein taake 1 ghante me files deliver ho sakein.";
    return waText;
}

// 5. Order id shown to the buyer and stored in the record
function makeOrderId() {
    const now = new Date();
    const stamp = String(now.getFullYear()).slice(2) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return "HP-" + stamp + "-" + rand;
}

// 6. Raw insert. Resolves true only when Supabase accepted the row.
async function postOrder(record) {
    const res = await fetch(ORDERS_ENDPOINT, {
        method: "POST",
        keepalive: true,
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        body: JSON.stringify(record)
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error("Supabase " + res.status + " " + body.slice(0, 200));
    }
    return true;
}

// 7. Local queue so a failed save is retried on the next page view
function readQueue() {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch (err) {
        return [];
    }
}

function writeQueue(items) {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-25)));
    } catch (err) {
        /* storage unavailable */
    }
}

function queueOrder(record) {
    const items = readQueue();
    items.push(record);
    writeQueue(items);
}

function queueSize() {
    return readQueue().length;
}

async function saveOrder(record) {
    try {
        await postOrder(record);
        return true;
    } catch (err) {
        console.warn("Order save failed, queued locally:", err.message);
        queueOrder(record);
        return false;
    }
}

// 8. Retry anything left over from an earlier visit
async function flushQueue() {
    const items = readQueue();
    if (!items.length) return;
    const remaining = [];
    for (const record of items) {
        try {
            await postOrder(record);
        } catch (err) {
            remaining.push(record);
        }
    }
    writeQueue(remaining);
}

// 9. Page ready
document.addEventListener("DOMContentLoaded", () => {
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach(item => {
        const question = item.querySelector(".faq-question");
        if (!question) return;
        question.addEventListener("click", () => {
            const isActive = item.classList.contains("active");
            faqItems.forEach(i => i.classList.remove("active"));
            if (!isActive) {
                item.classList.add("active");
            }
        });
    });

    const orderForm = document.getElementById("orderForm");
    const successModal = document.getElementById("successModal");
    const modalWaBtn = document.getElementById("modalWaBtn");

    flushQueue();

    if (!orderForm) return;

    orderForm.addEventListener("submit", function (e) {
        e.preventDefault();

        // Honeypot: real people never fill this hidden field
        const honey = document.getElementById("website");
        if (honey && honey.value.trim() !== "") {
            return;
        }

        const read = (id) => (document.getElementById(id)?.value || "").trim();

        const product = read("productSelect");
        const order = {
            _orderId: makeOrderId(),
            name: read("fullName"),
            clinic: read("clinicName"),
            city: read("city"),
            whatsapp: read("whatsappNumber"),
            product: product,
            payment_method: document.querySelector('input[name="paymentMethod"]:checked')?.value || "Raast / Bank",
            notes: read("notes") || null,
            price_pkr: priceForProduct(product),
            source: window.location.href,
            user_agent: navigator.userAgent
        };

        if (!order.name || !order.clinic || !order.city || !order.whatsapp || !order.product) {
            orderForm.reportValidity();
            return;
        }

        const waUrl = "https://wa.me/" + OFFICIAL_WHATSAPP_NUMBER + "?text=" +
            encodeURIComponent(buildOrderMessage(order));

        if (modalWaBtn) {
            modalWaBtn.href = waUrl;
        }

        // WhatsApp must open inside this click gesture, or mobile browsers block it.
        let waWindow = null;
        try {
            waWindow = window.open(waUrl, "_blank");
        } catch (err) {
            waWindow = null;
        }

        // Save the lead in the background (never blocks the WhatsApp tab)
        const record = Object.assign({}, order);
        delete record._orderId;
        saveOrder(record).then(saved => {
            const orderIdEl = document.getElementById("orderIdValue");
            if (orderIdEl) {
                orderIdEl.textContent = order._orderId + (saved ? "" : " (offline)");
            }
        });

        if (successModal) {
            const idLine = document.getElementById("orderIdValue");
            if (idLine) idLine.textContent = order._orderId;
            successModal.classList.add("active");
            successModal.setAttribute("data-wa-opened", waWindow ? "1" : "0");
        }

        orderForm.reset();
    });

    // Keep the queue honest if the network returns while the page is open
    window.addEventListener("online", flushQueue);
});

// 10. Modal controls
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

document.addEventListener("click", (e) => {
    const modal = e.target;
    if (modal && modal.id === "successModal") closeModal();
});

function closeModal() {
    const successModal = document.getElementById("successModal");
    if (successModal) {
        successModal.classList.remove("active");
    }
}
