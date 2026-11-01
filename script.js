// ========================================================
// HealthOps PK — Interactive Logic & Dynamic WhatsApp Routing
// ========================================================

// Official WhatsApp number (international format, no +)
const OFFICIAL_WHATSAPP_NUMBER = "923042917388";

// Optional lead-backup endpoint (Google Apps Script Web App / Formspree / FormSubmit).
// Khali chhor dein = band. Jab URL set ho, har order background me wahan bhi record hota hai.
const LEAD_WEBHOOK_URL = "";

// 1. Select Product in Form Helper
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

// 2. Copy To Clipboard Helper
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

// 3. Build the pre-filled WhatsApp order message
function buildOrderMessage(order) {
    let waText = "*Salam HealthOps Pakistan! Naya Order Submission:*\n\n";
    waText += "Doctor / Owner: " + order.fullName + "\n";
    waText += "Clinic / Hospital: " + order.clinicName + "\n";
    waText += "City: " + order.city + "\n";
    waText += "WhatsApp: " + order.whatsappNumber + "\n";
    waText += "Selected Package: " + order.productSelect + "\n";
    waText += "Preferred Payment: " + order.paymentMethod + "\n";
    if (order.notes) {
        waText += "Notes: " + order.notes + "\n";
    }
    waText += "\nMaine order confirm kar diya hai. Kindly payment details share karein taake 1 ghante me files deliver ho sakein.";
    return waText;
}

// 4. Send a silent copy of the lead to the backup endpoint, if configured
function backupLead(order) {
    if (!LEAD_WEBHOOK_URL) return;
    try {
        const payload = JSON.stringify({
            fullName: order.fullName,
            clinicName: order.clinicName,
            city: order.city,
            whatsappNumber: order.whatsappNumber,
            productSelect: order.productSelect,
            paymentMethod: order.paymentMethod,
            notes: order.notes,
            source: window.location.href,
            submittedAt: new Date().toISOString()
        });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(LEAD_WEBHOOK_URL, new Blob([payload], { type: "application/json" }));
        } else {
            fetch(LEAD_WEBHOOK_URL, {
                method: "POST",
                mode: "no-cors",
                keepalive: true,
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: payload
            }).catch(() => {});
        }
    } catch (err) {
        console.warn("Lead backup skipped:", err);
    }
}

// 5. Page ready
document.addEventListener("DOMContentLoaded", () => {
    // FAQ Accordion
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

    // Order form
    const orderForm = document.getElementById("orderForm");
    const successModal = document.getElementById("successModal");
    const modalWaBtn = document.getElementById("modalWaBtn");

    if (orderForm) {
        orderForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const read = (id) => (document.getElementById(id)?.value || "").trim();

            const order = {
                fullName: read("fullName"),
                clinicName: read("clinicName"),
                city: read("city"),
                whatsappNumber: read("whatsappNumber"),
                productSelect: read("productSelect"),
                paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || "Raast / Bank Transfer",
                notes: read("notes")
            };

            if (!order.fullName || !order.clinicName || !order.city || !order.whatsappNumber || !order.productSelect) {
                orderForm.reportValidity();
                return;
            }

            const waText = buildOrderMessage(order);
            const waUrl = "https://wa.me/" + OFFICIAL_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(waText);

            backupLead(order);

            // Local copy: agar WhatsApp window block ho jaye to order details recover ho sakein
            try {
                localStorage.setItem("healthops_last_order", waText);
            } catch (err) {
                /* storage unavailable — ignore */
            }

            if (modalWaBtn) {
                modalWaBtn.href = waUrl;
            }

            // IMPORTANT: window.open sirf isi user-gesture (submit click) ke andar
            // sync call karna zaroori hai, warna mobile Chrome popup block kar deta hai.
            let waWindow = null;
            try {
                waWindow = window.open(waUrl, "_blank");
            } catch (err) {
                waWindow = null;
            }

            // Modal hamesha dikhao: agar tab khul gaya to yeh confirmation hai,
            // agar block hua to modal ka button manual fallback hai.
            if (successModal) {
                successModal.classList.add("active");
                successModal.setAttribute("data-wa-opened", waWindow ? "1" : "0");
            }

            orderForm.reset();
        });
    }

    // Modal: backdrop click aur Escape se band
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });
    document.querySelectorAll("#successModal").forEach(modal => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    });
});

// Close Modal
function closeModal() {
    const successModal = document.getElementById("successModal");
    if (successModal) {
        successModal.classList.remove("active");
    }
}
