const pw = "$2y$10$samplehash";
fetch("http://localhost:5000/api/login/customer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "vandit@example.com", password: pw }),
})
  .then((r) => r.json())
  .then((d) => console.log(JSON.stringify(d, null, 2)))
  .catch((e) => console.error(e));
