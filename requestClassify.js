// request ROUTER 

async function handleRequestClassify(request){
    if(isAPIRequest(request)){
        return handleAPIRequest(request); // a function 
    }

    if(isStaticAssets(request)){
        return handleStaticAssets(request); // functon 
    }

    if(isDocumentRequest(request)){
        return handleDocument(request); // function
    }

    return fetch(request);
}


function isAPIRequest(request){
    const url = new URL(request.url);
    return url.pathname.startsWith("/api/");
}

function isStaticAssets(request){
    return [
        "script",
        "style",
        "image",
        "font"
    ].includes(request.destination);
}

function isDocumentRequest(request){
    return request.destination === "document";
}