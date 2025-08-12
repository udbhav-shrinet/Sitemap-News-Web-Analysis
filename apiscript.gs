// This function runs when the web app URL is accessed.
function doGet(e) {
  const siteUrl = e.parameter.url;
  if (!siteUrl) {
    return createJsonResponse({ error: "URL parameter is missing." });
  }
  try {
    const newsData = fetchNewsFromSite(siteUrl);
    return createJsonResponse({ data: newsData });
  } catch (err) {
    return createJsonResponse({ error: `An error occurred: ${err.message}` });
  }
}

// This function contains the core logic.
function fetchNewsFromSite(site) {
  const SITEMAP_KEYWORDS = ['google-news', 'all-news', 'news', 'news-sitemap', 'newssitemap'];
  const rows = [];
  const baseUrl = site.replace(/\/$/, "");
  const robotsUrl = baseUrl + "/robots.txt";
  
  const robotsResponse = UrlFetchApp.fetch(robotsUrl, { muteHttpExceptions: true });
  if (robotsResponse.getResponseCode() !== 200) throw new Error("Could not fetch robots.txt from the server.");

  const sitemapLines = robotsResponse.getContentText().split('\n');
  let sitemapUrl = null;

  for (let keyword of SITEMAP_KEYWORDS) {
    const line = sitemapLines.find(l => l.toLowerCase().startsWith("sitemap:") && l.toLowerCase().includes(keyword));
    if (line) {
      sitemapUrl = line.split(/sitemap:/i)[1].trim();
      break;
    }
  }

  if (!sitemapUrl) throw new Error(`No valid news sitemap found in robots.txt for ${site}`);
  
  const sitemapXml = UrlFetchApp.fetch(sitemapUrl).getContentText();
  const document = XmlService.parse(sitemapXml);
  const root = document.getRootElement();
  const namespaceNews = XmlService.getNamespace("http://www.google.com/schemas/sitemap-news/0.9");
  const urls = root.getChildren("url", root.getNamespace());

  if (!urls || urls.length === 0) return [];

  urls.forEach((urlElement) => {
    const loc = urlElement.getChildText("loc", root.getNamespace()) || "";
    const news = urlElement.getChild("news", namespaceNews);
    if (!news) return;

    const pub = news.getChild("publication", namespaceNews);
    const name = pub?.getChildText("name", namespaceNews) || '';
    const title = news.getChildText("title", namespaceNews) || '';
    const pubDate = news.getChildText("publication_date", namespaceNews) || '';
    // *** ADDED KEYWORDS BACK IN ***
    const keywords = news.getChildText("keywords", namespaceNews) || '';
    
    rows.push({ sourceName: name, title: title, publicationTime: pubDate, url: loc, keywords: keywords });
  });

  return rows;
}

// Helper function to create a JSON response.
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
