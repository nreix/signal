/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Posters TMDb (films/séries). Les autres catégories utilisent un fallback dégradé.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        pathname: "/b/**",
      },
      {
        protocol: "https",
        hostname: "media.senscritique.com",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "books.google.com",
        pathname: "/books/**",
      },
      {
        protocol: "https",
        hostname: "books.googleusercontent.com",
        pathname: "/**",
      },
      // Pochettes d'albums/titres et couvertures de playlists Spotify.
      {
        protocol: "https",
        hostname: "**.scdn.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.spotifycdn.com",
        pathname: "/**",
      },
      // Pochettes Pitchfork (Best New Albums).
      {
        protocol: "https",
        hostname: "media.pitchfork.com",
        pathname: "/photos/**",
      },
    ],
  },
};

export default nextConfig;
