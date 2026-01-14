const tg = window.Telegram.WebApp;
tg.expand();

document.getElementById("load").onclick = async () => {
  document.getElementById("output").innerText = "Caricamento...";

  const res = await fetch("https://TUO_BACKEND/api/user-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: tg.initDataUnsafe.user.id
    })
  });

  const data = await res.json();

  document.getElementById("output").innerHTML = `
    <p><b>User:</b> ${data.username}</p>
    <p><b>Crediti:</b> ${data.credits}</p>
  `;
};
