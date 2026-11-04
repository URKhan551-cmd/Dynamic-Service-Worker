export function onInstall(event){
    console.log("Service worker install event started");

    event.waitUntil( (async () => {
        console.log('Service Worker installation completed');
    })()
);
}


export function onActivate(event){
    console.log("Service Worker Activation event start..");

    event.waitUntil((async () => {
        console.log("Service Worker activation completed");
    })()
)
}
