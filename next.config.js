/** @type {import('next').NextConfig} */
module.exports = {
    reactStrictMode: true,
    productionBrowserSourceMaps: true,
    async rewrites() {
        return [{
            source: "/robots.txt",
            destination: "/api/robots",
        }, ];
    },
};