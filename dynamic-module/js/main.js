const registerButton = document.querySelector( '#register-worker');
const statusElement = document.querySelector("#sw-status");


function updateControllerStatus(){
    if(navigator.serviceWorker.controller){
        statusElement.textContent = 'This page is controlled by an active service worker.';
    }else {
        statusElement.textContent = 'No service worker currently controls this page. reload after activation.'
    }
}



registerButton.addEventListener("click", async () => {
    if(!('serviceWorker' in navigator)){
        statusElement.textContent = 'Service Workers is not supported.';
        return;
    }

    try{
        const registration = await navigator.serviceWorker.register('./sw.js', {type: 'module'});
        console.log('[Application] Registraction:', registration);

        statusElement.textContent = `Registered successful. Scope: ${registration.scope}`;

        // wait until worker is active for tthe registration.
        const readyRegistration = await navigator.serviceWorker.ready;

        console.log('[Application] Active worker:', readyRegistration.active);

        updateControllerStatus();
    } catch(error){
        console.error('[Application] Registration failed:', error);
        statusElement.textContent = `Registration Failed: ${error.message}`;
    } finally{
        registerButton.disabled = false;
    }
});

navigator.serviceWorker?.addEventListener('controllerchange', () => {
    console.log('[Application] Controller changed:', navigator.serviceWorker.controller);

    updateControllerStatus();
})