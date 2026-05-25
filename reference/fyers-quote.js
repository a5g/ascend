const FyersAPI = require("fyers-api-v3").fyersModel;

var fyers = new FyersAPI();
fyers.setAppId(appId);
// fyers.setRedirectUrl("https://url.xyz");
fyers.setAccessToken(accessToken);

var inp = ["NSE:SBIN-EQ", "NSE:TCS-EQ"];

fyers
  .getQuotes(inp)
  .then((response) => {
    console.log(response);
  })
  .catch((error) => {
    console.log(error);
  });
