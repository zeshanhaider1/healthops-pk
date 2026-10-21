// ========================================================
// HealthOps PK — Interactive Logic & Dynamic WhatsApp Routing
// ========================================================

// Configuration: User's official WhatsApp Number (International format without +)
const OFFICIAL_WHATSAPP_NUMBER = "923042917388";

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
            btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 2000);
        }
    }).catch(err => {
        console.error("Copy failed", err);
    });
}

// 3. FAQ Accordion Toggle
document.addEventListener("DOMContentLoaded", () => {
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach(item => {
        const question = item.querySelector(".faq-question");
        question.addEventListener("click", () => {
            const isActive = item.classList.contains("active");
            faqItems.forEach(i => i.classList.remove("active"));
            if (!isActive) {
                item.classList.add("active");
            }
        });
    });

    // 4. Form Submission & WhatsApp Routing
    const orderForm = document.getElementById("orderForm");
    const successModal = document.getElementById("successModal");
    const modalWaBtn = document.getElementById("modalWaBtn");

    if (orderForm) {
        orderForm.addEventListener("submit", function(e) {
            e.preventDefault();

            const fullName = document.getElementById("fullName").value.trim();
            const clinicName = document.getElementById("clinicName").value.trim();
            const city = document.getElementById("city").value.trim();
            const whatsappNumber = document.getElementById("whatsappNumber").value.trim();
            const productSelect = document.getElementById("productSelect").value;
            const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "Raast / Bank Transfer";
            const notes = document.getElementById("notes").value.trim();

            // Construct clean pre-filled WhatsApp message
            let waText = `*Salam HealthOps Pakistan! Naya Order Submission:*\n\n`;
            waText += `👤 *Doctor / Owner:* ${fullName}\n`;
            waText += `🏥 *Clinic / Hospital:* ${clinicName}\n`;
            waText += `📍 *City:* ${city}\n`;
            waText += `📱 *WhatsApp:* ${whatsappNumber}\n`;
            waText += `📦 *Selected Package:* ${productSelect}\n`;
            waText += `💳 *Preferred Payment:* ${paymentMethod}\n`;
            if (notes) {
                waText += `📝 *Notes:* ${notes}\n`;
            }
            waText += `\n_Maine payment transfer kardi hai / kar raha hoon. Kindly payment verify karke 1 ghante me files deliver karein._`;

            const encodedWaUrl = `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

            // Set modal button link
            if (modalWaBtn) {
                modalWaBtn.href = encodedWaUrl;
            }

            // Post to Netlify Form in background using fetch
            const formData = new FormData(orderForm);
            fetch("/", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(formData).toString()
            }).catch(err => {
                console.log("Netlify form background submission log:", err);
            });

            // Open modal
            if (successModal) {
                successModal.classList.add("active");
            }

            // Optional: Auto open WhatsApp in new tab after 1.2 seconds
            setTimeout(() => {
                window.open(encodedWaUrl, "_blank");
            }, 1200);
        });
    }
});

// Close Modal
function closeModal() {
    const successModal = document.getElementById("successModal");
    if (successModal) {
        successModal.classList.remove("active");
    }
}
