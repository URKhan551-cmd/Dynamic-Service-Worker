// our application over local host
import http from "node:http";
import { readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const mimeType = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
};

const server  = http.createServer(async (req, res) => {
    try{
        const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = decodeURIComponent(url.pathname);

        const requestedPath = pathname === '/' ? '/index.html' : pathname; 

        const filePath = path.resolve(
            root,
            `.${requestedPath}`
        );

// calculate path relative to project root
const relativePath = path.relative(root, filePath);

// prevent directory traversal.
const isOutsideRoot = relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);

if(isOutsideRoot){
    console.warn('[403] Blocked:', pathname);

    res.writeHead(403);
    return res.end('Forbidden');
}

       

        const content = await readFile(filePath);
        //7: determine response content type
        const extension = path.extname(filePath);
         
        const contentType = mimeType[extension] ?? 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
        });

        res.end(content);
        console.log(`[200] ${pathname}`);
    } catch(error) {
        if(error instanceof URIError){
            res.writeHead(400);
            return res.end('Bad Request');
        }

        if(error.code === 'ENOENT'){
            console.warn(`[404] ${req.url}`);

            res.writeHead(404);
            return res,end('File Not Found')
        }
        
        console.error('[Server ERROR]', error);
        res.writeHead(500);
        res.end('Internal Server Error');
    }
});

server.listen(PORT, () => {
    console.log("============================");
    console.log("Dynamic Service Workler Lab");
    console.log(`Root: ${root}`);
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('=================================');
})


// http.createServer() ccreate server http every inccoming req invoke our callback
// new URL  seperate the pathname from query parameters
// path.resolve() produce an absolute filesystem path
// readFile() retrieves the req resources.
// Content-Type tells the browser how to interpret the response.
// why Cache-Control = no-cahce    =>> we want tto avoid browser ordinary http 
// cache interfering with our initial experiments this does not disable the seperate Cache API 
// that our service worker will use.
