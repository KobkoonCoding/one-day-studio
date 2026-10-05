(function () {
  "use strict";

  const PACKAGES = [
    { id: "web", name: "เว็บไซต์ร้านค้าหน้าเดียว", price: 1500, deposit: 0.5, time: "ส่งภายใน 1 วัน",
      items: ["ใช้งานบนมือถือได้ดี", "เมนู/สินค้า + ราคา", "ปุ่มโทร / LINE / แผนที่", "แก้ฟรี 2 ครั้ง"],
      hint: "ชื่อร้าน / ขายอะไร / รายการสินค้า+ราคา / เวลาเปิด / ที่อยู่ / ลิงก์ Google Maps / โทนสีที่ชอบ" },
    { id: "resume", name: "Resume + Cover Letter ภาษาอังกฤษ", price: 490, deposit: 1, time: "ส่งภายใน 3 ชม.",
      items: ["ส่งข้อมูลเป็นภาษาไทยได้", "ปรับให้ตรงตำแหน่งที่สมัคร", "ไฟล์ PDF + แก้ไขได้", "แก้ฟรี 1 ครั้ง"],
      hint: "ตำแหน่งที่จะสมัคร / การศึกษา / ประวัติการทำงาน (ที่ไหน ปีไหน ทำอะไร) / ทักษะ / ภาษา / ผลงานเด่น" },
    { id: "caption", name: "แคปชั่นขายของ 15 โพสต์", price: 590, deposit: 1, time: "ส่งภายใน 2 ชม.",
      items: ["พาดหัว + เนื้อหา + แฮชแท็ก", "ขายตรง / ให้ความรู้ / รีวิว / โปร", "เลือกสไตล์ภาษาได้", "แก้ฟรี 1 ครั้ง"],
      hint: "ขายอะไร / ราคา / กลุ่มลูกค้า / จุดเด่น 3 ข้อ / โปรโมชั่น / ลงแพลตฟอร์มไหน / สไตล์ภาษา" },
    { id: "translate", name: "แปลเอกสาร ไทย↔อังกฤษ (ไม่เกิน 2 หน้า)", price: 390, deposit: 1, time: "ส่งภายใน 2 ชม.",
      items: ["แปลเป็นธรรมชาติ ไม่ใช่แปลตรงตัว", "จัดรูปแบบตามต้นฉบับ", "แก้ฟรี 1 ครั้ง"],
      hint: "แปลจากภาษาอะไรเป็นอะไร / ใช้ทำอะไร / แนบไฟล์ต้นฉบับทาง LINE หลังโอน" },
  ];

  const cfg = window.SHOP_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  function renderPackages() {
    const grid = $("pkgGrid");
    const select = $("pkg");
    PACKAGES.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.id = p.id;
      const h3 = document.createElement("h3");
      h3.textContent = p.name;
      const price = document.createElement("div");
      price.className = "price";
      price.textContent = p.price.toLocaleString("th-TH") + " บาท";
      const ul = document.createElement("ul");
      p.items.forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
      const time = document.createElement("span");
      time.className = "time";
      time.textContent = p.time;
      card.append(h3, price, ul, time);
      card.addEventListener("click", () => selectPackage(p.id, true));
      grid.appendChild(card);

      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name + " — " + p.price + " บาท";
      select.appendChild(opt);
    });
    select.addEventListener("change", () => selectPackage(select.value, false));
    selectPackage(PACKAGES[0].id, false);
  }

  function selectPackage(id, scroll) {
    const p = PACKAGES.find((x) => x.id === id);
    if (!p) return;
    $("pkg").value = id;
    document.querySelectorAll(".card").forEach((c) => c.classList.toggle("sel", c.dataset.id === id));
    $("detail").placeholder = p.hint;
    $("detailLabel").textContent = "รายละเอียดงาน (" + p.name + ")";
    if (scroll) $("order").scrollIntoView({ behavior: "smooth" });
  }

  // ---- PromptPay EMVCo payload ----
  function tlv(tag, value) {
    return tag + String(value.length).padStart(2, "0") + value;
  }

  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function promptpayPayload(id, amount) {
    const digits = String(id).replace(/\D/g, "");
    let target;
    if (digits.length === 10 && digits.startsWith("0")) {
      target = tlv("01", ("0066" + digits.slice(1)).padStart(13, "0"));
    } else if (digits.length === 13) {
      target = tlv("02", digits);
    } else {
      return null;
    }
    const merchant = tlv("29", tlv("00", "A000000677010111") + target);
    const body = tlv("00", "01") + tlv("01", "12") + merchant + tlv("58", "TH") +
      tlv("53", "764") + tlv("54", amount.toFixed(2)) + "6304";
    return body + crc16(body);
  }

  function orderId() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return "OD" + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) +
      "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  function onSubmit(e) {
    e.preventDefault();
    const p = PACKAGES.find((x) => x.id === $("pkg").value);
    const name = $("name").value.trim();
    const contact = $("contact").value.trim();
    const detail = $("detail").value.trim();
    if (!p || !name || !contact || detail.length < 10) {
      alert("กรุณากรอกข้อมูลให้ครบ (รายละเอียดอย่างน้อย 10 ตัวอักษร)");
      return;
    }
    const payNow = Math.round(p.price * p.deposit);
    const id = orderId();
    const summary = [
      "🧾 ใบสั่งงาน " + id,
      "แพ็กเกจ: " + p.name,
      "ราคา: " + p.price + " บาท" + (p.deposit < 1 ? " (มัดจำ " + payNow + " บาท)" : ""),
      "ชื่อ: " + name,
      "ติดต่อ: " + contact,
      "รายละเอียด:",
      detail,
    ].join("\n");

    $("summary").textContent = summary;
    $("result").style.display = "block";

    const payload = cfg.promptpayId ? promptpayPayload(cfg.promptpayId, payNow) : null;
    const qrBox = $("qr");
    qrBox.innerHTML = "";
    if (payload && window.QRCode) {
      new window.QRCode(qrBox, { text: payload, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M });
      $("payBox").style.display = "grid";
      $("closedMsg").style.display = "none";
    } else {
      $("payBox").style.display = "none";
      $("closedMsg").style.display = "block";
    }
    $("amount").textContent = payNow.toLocaleString("th-TH") + " บาท";
    $("payNote").textContent = p.deposit < 1
      ? "มัดจำ 50% — ส่วนที่เหลือจ่ายหลังเห็นตัวอย่างงาน"
      : "ชำระเต็มจำนวนก่อนเริ่มงาน";
    $("accName").textContent = cfg.accountName ? "ชื่อบัญชี: " + cfg.accountName : "";

    const lineBtn = $("lineBtn");
    if (cfg.lineId) {
      lineBtn.href = "https://line.me/ti/p/~" + encodeURIComponent(cfg.lineId.replace(/^@/, ""));
      lineBtn.style.display = "inline-block";
    } else {
      lineBtn.style.display = "none";
    }
    $("result").scrollIntoView({ behavior: "smooth" });
  }

  function onCopy() {
    const text = $("summary").textContent;
    const done = () => { $("copyBtn").textContent = "✅ คัดลอกแล้ว"; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (err) { alert("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง"); }
    ta.remove();
  }

  renderPackages();
  $("orderForm").addEventListener("submit", onSubmit);
  $("copyBtn").addEventListener("click", onCopy);
})();
