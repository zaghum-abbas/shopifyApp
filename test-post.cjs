const axios = require("axios");

axios
  .post("https://webhook.site/8dc5a55f-f59c-4b5e-8344-150c74ef41c3", {
    test: "hello",
  })
  .then((res) => {
    console.log("POST sent! Status:", res.status);
  })
  .catch((err) => {
    console.error("Error:", err.message);
  });
