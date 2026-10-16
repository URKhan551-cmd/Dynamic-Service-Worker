const statusElement = document.querySelector("#sw-status");
const networkElement = document.querySelector("#network-status");
const checkButton = document.querySelector("#check-worker");

async function registerServiceWorker(){
  if(!("serviceWorker" in navigator)){
    statusElement.textContent = "Service workers are not supported in this browser.";
    return;
  }

  try{
    const registration = await navigator.serviceWorker.register("./sw.js");
    // here registration is an object 
    statusElement.textContent =
      `Registered. Scope: ${registration.scope}`;

    console.log("Registration", registration);
    
  } catch (error){
    statusElement.textContent = "Registration failed. Check the console.";
    console.error("Service worker registration failed:", error);
  }
};

function updateNetworkStatus(){
   networkElement.textContent = navigator.online ? "Browser reports: Online"
    : "Browser reports: Offline";
  
};

checkButton.addEventListener("click", async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  console.log("Current registration:", registration);
  console.log("Controlling worker:", navigator.serviceWorker.controller);

  statusElement.textContent = registration
    ? "A service worker registration exists."
    : "No registration found for this page.";
})

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

updateNetworkStatus();
registerServiceWorker();
// to register sw in browser 


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
     .then(reg => {
        console.log('SW Registered, scope:', reg.scope);
      })
     .catch(err => {
        console.log('SW Registration failed:', err);
      });
  });
}
