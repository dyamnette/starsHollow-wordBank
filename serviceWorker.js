var assests = 
[
    "/",
    "/index.html",
    "/script.js",
    "/manifest.json",
    "/puzzle.html",
    "/restart.html",
    "/unlock.html",
    "/icons/icon-192.png",
    "/icons/icon-512.png"
]

self.addEventListener("install", function(installEvent)
{
    installEvent.waitUntil(caches.open("word-bank-puzzle").then(function(cache)
    {
    cache.addAll(assests)
    }))
})

self.addEventListener("fetch", function(fetchEvent)
{
    fetchEvent.respondWith(caches.match(fetchEvent.request).then(function(res)
{
    return res || fetch(fetchEvent.request)
}))
})