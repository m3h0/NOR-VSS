import fs from 'fs';

async function fetchImage(url, dest) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Unexpected response ${res.statusText}`);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(buffer));
        console.log('Saved', dest);
    } catch (err) {
        console.error('Error downloading', url, err);
    }
}

await fetchImage('https://images.unsplash.com/photo-1582297120610-1845bb8c3468?q=80&w=1024&auto=format&fit=crop', 'public/andesite.jpg');
await fetchImage('https://images.unsplash.com/photo-1549487933-ae16c2c62c4c?q=80&w=1024&auto=format&fit=crop', 'public/tectonic.jpg');
