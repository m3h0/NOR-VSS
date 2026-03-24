const https = require('https');
const fs = require('fs');

function download(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return download(res.headers.location, dest).then(resolve).catch(reject);
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function run() {
    await download('https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Andesite_-_Lousal_-_Portugal.JPG/640px-Andesite_-_Lousal_-_Portugal.JPG', 'public/andesite.jpg');
    console.log('Saved andesite.jpg');

    await download('https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Plates_tect2_en.svg/640px-Plates_tect2_en.svg.png', 'public/tectonic.png');
    console.log('Saved tectonic.png');
}

run().catch(console.error);
