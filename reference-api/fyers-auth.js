const FyersAPI = require("fyers-api-v3").fyersModel;
const readline = require("readline");
const fs = require("fs");

const appId = "KNDJDFEVN6-100";
const secretKey = "P7B8YQ60OM";
const redirectURL = "https://www.google.com";

// Create a new instance of FyersAPI
var fyers = new FyersAPI();

// Set your APPID obtained from Fyers (replace "xxx-1xx" with your actual APPID)
fyers.setAppId(appId);

// Set the RedirectURL where the authorization code will be sent after the user grants access
fyers.setRedirectUrl(redirectURL);

var generateAuthcodeURL = fyers.generateAuthCode();
console.log("Click on the below url to open the link in browser");
console.log(generateAuthcodeURL);
console.log("------------------------------------");
console.log("------------------------------------");
// Define the authorization code and secret key required for generating access token
const authcode = "eyJxxxx"; // Replace with the actual authorization code obtained from the user
// const secretKey = "xxxxx"; // Replace with your secret key provided by Fyers
fyers
  .generate_access_token({ client_id: appId, secret_key: secretKey, auth_code: auth_code })
  .then((response) => {
    console.log(response);
  })
  .catch((error) => {
    console.log(error);
  });
// ----------------------------------------------------------------------------------
// Sample Success Response
// ----------------------------------------------------------------------------------

// {
//   's': 'ok',
//   'code': 200,
//   'message': '',
//   'access_token': 'eyJ0eXAiOi***.eyJpc3MiOiJh***.HrSubihiFKXOpUOj_7***',
//   'refresh_token': 'eyJ0eXAiO***.eyJpc3MiOiJh***.67mXADDLrrleuEH_EE***'
// }
