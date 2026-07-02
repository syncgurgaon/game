// Generates a 1080x1350 PNG share card of the final leaderboard
// Returns a Promise<Blob>

const APP_URL = window.location.origin;

export async function generateShareCard(state, code) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Bg
  ctx.fillStyle = "#F4F0EA";
  ctx.fillRect(0, 0, W, H);

  // dot pattern
  ctx.fillStyle = "rgba(26,26,26,0.08)";
  for (let y = 18; y < H; y += 28) {
    for (let x = 18; x < W; x += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Header chip
  drawChip(ctx, 60, 70, "GUESS THE LIL' ONE", "#FFE873");

  // Big title
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 110px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText("FINAL RESULTS", 60, 240);

  // Room code chip
  drawChip(ctx, 60, 270, `ROOM ${code}`, "#7BF1A8", 24);

  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  // Winner banner
  ctx.fillStyle = "#FF8A5B";
  drawNbBox(ctx, 60, 360, W - 120, 200);
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 56px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText("🏆 WINNER", 90, 430);
  ctx.font = "900 92px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText(truncate(ctx, winner?.name || "?", W - 180), 90, 520);

  // Try to draw winner's photo (top right of banner)
  if (winner?.photo) {
    try {
      const img = await loadImage(winner.photo);
      // round square
      ctx.save();
      const px = W - 60 - 160;
      const py = 380;
      const ps = 160;
      ctx.beginPath();
      roundRect(ctx, px, py, ps, ps, 18);
      ctx.clip();
      ctx.drawImage(img, px, py, ps, ps);
      ctx.restore();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#1A1A1A";
      ctx.beginPath();
      roundRect(ctx, px, py, ps, ps, 18);
      ctx.stroke();
    } catch (err) {
      console.warn("share card: failed to load winner photo", err);
    }
  }

  // Rankings
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 48px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText("RANKINGS", 60, 660);

  const rowH = 88;
  const rowColors = ["#FFE873", "#B4A2FE", "#FF8A5B", "#FFFDF9", "#FFFDF9", "#FFFDF9", "#FFFDF9", "#FFFDF9"];
  sorted.slice(0, 8).forEach((p, i) => {
    const y = 700 + i * (rowH + 14);
    ctx.fillStyle = rowColors[i];
    drawNbBox(ctx, 60, y, W - 120, rowH);
    ctx.fillStyle = "#1A1A1A";
    ctx.font = "900 44px 'Cabinet Grotesk', Nunito, sans-serif";
    ctx.fillText(`${i + 1}.`, 90, y + 58);
    ctx.font = "800 40px Nunito, sans-serif";
    ctx.fillText(truncate(ctx, p.name, W - 360), 170, y + 58);
    ctx.font = "900 44px 'Cabinet Grotesk', Nunito, sans-serif";
    const scoreText = `${p.score}`;
    const w = ctx.measureText(scoreText).width;
    ctx.fillText(scoreText, W - 90 - w, y + 58);
  });

  // Footer bar with app URL
  const footerH = 140;
  const footerY = H - footerH;

  // Gradient background for footer
  const grad = ctx.createLinearGradient(0, footerY, W, footerY);
  grad.addColorStop(0, "#FF8A5B");
  grad.addColorStop(0.5, "#FFB3C7");
  grad.addColorStop(1, "#B4A2FE");
  ctx.fillStyle = grad;
  ctx.fillRect(0, footerY, W, footerH);

  // Top border for footer
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(W, footerY);
  ctx.stroke();

  // CTA text
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 38px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText("🎮 PLAY WITH YOUR CREW", 60, footerY + 52);

  // App URL
  ctx.font = "800 30px Nunito, sans-serif";
  ctx.fillText(APP_URL.replace(/^https?:\/\//, ""), 60, footerY + 96);

  // QR-like icon placeholder — small "scan me" chip
  drawChip(ctx, W - 280, footerY + 30, "WHOSE PIC IS IT?!", "#FFE873", 20);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
}

// Generates an Instagram Story-optimized card (1080x1920)
export async function generateStoryCard(state, code) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#FF8A5B");
  bgGrad.addColorStop(0.4, "#FFB3C7");
  bgGrad.addColorStop(0.7, "#B4A2FE");
  bgGrad.addColorStop(1, "#A8DCFF");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Dot pattern overlay
  ctx.fillStyle = "rgba(26,26,26,0.06)";
  for (let y = 18; y < H; y += 28) {
    for (let x = 18; x < W; x += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Top chip
  drawChip(ctx, 80, 120, "WHOSE PIC IS IT?!", "#FFE873", 32);

  // Big title
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 100px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText("GAME", 80, 300);
  ctx.fillText("OVER! 🏆", 80, 410);

  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  // Winner card
  ctx.fillStyle = "#FFE873";
  drawNbBox(ctx, 80, 490, W - 160, 240);
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 48px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText("🏆 WINNER", 120, 560);
  ctx.font = "900 84px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText(truncate(ctx, winner?.name || "?", W - 240), 120, 670);

  // Winner photo
  if (winner?.photo) {
    try {
      const img = await loadImage(winner.photo);
      ctx.save();
      const px = W - 80 - 180;
      const py = 510;
      const ps = 180;
      ctx.beginPath();
      roundRect(ctx, px, py, ps, ps, 18);
      ctx.clip();
      ctx.drawImage(img, px, py, ps, ps);
      ctx.restore();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#1A1A1A";
      ctx.beginPath();
      roundRect(ctx, px, py, ps, ps, 18);
      ctx.stroke();
    } catch (err) {
      // skip photo
    }
  }

  // Rankings
  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 48px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText("RANKINGS", 80, 850);

  const rowH = 88;
  const rowColors = ["#FFE873", "#B4A2FE", "#FF8A5B", "#FFFDF9", "#FFFDF9", "#FFFDF9"];
  sorted.slice(0, 6).forEach((p, i) => {
    const y = 890 + i * (rowH + 14);
    ctx.fillStyle = rowColors[i] || "#FFFDF9";
    drawNbBox(ctx, 80, y, W - 160, rowH);
    ctx.fillStyle = "#1A1A1A";
    ctx.font = "900 44px 'Cabinet Grotesk', Nunito, sans-serif";
    ctx.fillText(`${i + 1}.`, 110, y + 58);
    ctx.font = "800 40px Nunito, sans-serif";
    ctx.fillText(truncate(ctx, p.name, W - 400), 190, y + 58);
    ctx.font = "900 44px 'Cabinet Grotesk', Nunito, sans-serif";
    const scoreText = `${p.score}`;
    const sw = ctx.measureText(scoreText).width;
    ctx.fillText(scoreText, W - 110 - sw, y + 58);
  });

  // Bottom CTA section
  const ctaY = H - 280;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(ctx, 60, ctaY, W - 120, 220, 24);
  ctx.fill();
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = "#1A1A1A";
  ctx.font = "900 42px 'Cabinet Grotesk', Nunito, sans-serif";
  ctx.fillText("🎮 PLAY WITH YOUR CREW", 100, ctaY + 60);

  ctx.font = "800 34px Nunito, sans-serif";
  ctx.fillText(APP_URL.replace(/^https?:\/\//, ""), 100, ctaY + 110);

  ctx.font = "700 26px Nunito, sans-serif";
  ctx.fillStyle = "rgba(26,26,26,0.7)";
  ctx.fillText("Create a room • Share with friends • Guess whose pic!", 100, ctaY + 160);

  // Swipe up hint
  ctx.fillStyle = "rgba(26,26,26,0.5)";
  ctx.font = "700 24px Nunito, sans-serif";
  const swipeText = "Add link sticker to let friends join ☝️";
  const stw = ctx.measureText(swipeText).width;
  ctx.fillText(swipeText, (W - stw) / 2, H - 40);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
}

function drawChip(ctx, x, y, text, bg, fontSize = 28) {
  ctx.font = `900 ${fontSize}px 'Cabinet Grotesk', Nunito, sans-serif`;
  const padX = 18;
  const padY = 10;
  const w = ctx.measureText(text).width + padX * 2;
  const h = fontSize + padY * 2;
  ctx.fillStyle = bg;
  drawNbBox(ctx, x, y, w, h);
  ctx.fillStyle = "#1A1A1A";
  ctx.fillText(text, x + padX, y + fontSize + padY - 4);
}

function drawNbBox(ctx, x, y, w, h, r = 14) {
  ctx.save();
  // shadow
  ctx.fillStyle = "#1A1A1A";
  roundRect(ctx, x + 6, y + 6, w, h, r);
  ctx.fill();
  // body — caller has set fillStyle for body before; preserve it via ctx state
  ctx.restore();
  // re-fill body in caller's color (caller pre-set fillStyle)
  const prev = ctx.fillStyle;
  ctx.fillStyle = prev;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#1A1A1A";
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}
