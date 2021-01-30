const htmlparser2 = require('htmlparser2');
const prompt = require('prompt');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const properties = [
  {
    name: 'url',
    validator: /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/,
    warning: 'URL should be valid'
  }
];
prompt.start();

// get the url 
getInput = async () => {
  return new Promise((res, rej) => {
    prompt.get(properties, function (err, input) {
      if (err) { return onErr(err); }
      return res(input);
    })
  });
}

// extract data  
extractData = async (url) => {
  console.profile('CRAWLING !');

  // get the data  
  let res = await axios(url).catch((err) => onErr(err));

  console.profile('CRAWLING !');

  // if status is not 200
  if (res.status !== 200) onErr('UNABLE TO CRAWL WEBSITE !');
  return res;
}

crawlWebPage = async (html) => {
  let itemDetails = {};
  let similarItems = [];
  const dom = htmlparser2.parseDOM(html, {
    xmlMode: true,
    decodeEntities: false, // Decode HTML entities.
    withStartIndices: false, // Add a `startIndex` property to nodes.
    withEndIndices: false, // Add an `endIndex` property to nodes.
  });

  // let cleanHtml = DOMPurify.sanitize(dom)

  let $ = cheerio.load(dom, {
    decodeEntities: false, //
    xml: {
      xml: true,
      normalizeWhitespace: true,
    }
  });

  // get the data 
  const similarTags = $('.kfs-item-container');
  // let firstIndex = html.indexOf(`a-bordered a-horizontal-stripes a-spacing-micro a-size-small ucc-comparison-table`);
  // const similarTags = $('.btf-content-25_feature_div');
  const aboutTags = $('.a-section.a-spacing-medium.a-spacing-top-small > ul');
  const itemTags = $('.centerColAlign.centerColAlign-bbcxoverride');
  const priceTags = $('.a-size-medium.a-color-price');

  // item list 
  itemTags.each(function () {
    if ($(this).find('h1').text() !== '')
      itemDetails = {
        'name': $(this).find('h1').text().replace(/\r?\n|\r/g, ''),
        'price': 0,
        'details': []
      };
  });

  // about tag
  aboutTags.each(function () {
    if ($(this).find('li').text() !== '')
      itemDetails.details.push($(this).find('li').text().replace(/\r?\n|\r/g, ''))
  });

  // get the price
  priceTags.each(function () {
    if ($(this).text() !== '' && $(this).text() !== ' ')
      itemDetails.price = $(this).text().replace(/\r?\n|\r/g, '')
  });

  // get the similar tags 
  similarTags.children().each(function () {
    if ($(this).text() !== '' && $(this).text() !== '&nbsp;')
      similarItems.push({
        'name': $(this).text().replace(/\r?\n|\r/g, '').trim().replace(/\s+/g, '|'),
        'link': "https://www.amazon.in" + $(this).children().attr('href')
      });
  });

  // returning the data 
  return {
    itemDetails: itemDetails,
    similarItems: similarItems
  }
}

hitCrawl = async () => {
  let url = await getInput();
  let crawledData = {};
  let dataFetched = await extractData(url);

  // data fetched 
  if (dataFetched && dataFetched.data) {
    let html = dataFetched.data;
    crawledData = await crawlWebPage(html);
  } else onErr('UNABLE TO CRAWL WEBSITE !');

  // similar link check
  for (let i = 0; i < crawledData.similarItems.length; i++) {
    if (crawledData.similarItems[i].link && crawledData.similarItems[i].link !== '') {
      let res = await extractData(crawledData.similarItems[i].link);
      if (res && res.data) {
        let htmlNew = res.data;
        let crawledDataNew = await crawlWebPage(htmlNew);
        crawledData.similarItems[i] = {
          ...crawledData.similarItems[i],
          similarItems: crawledDataNew
        }
      }
    }
  }

  fs.writeFileSync("crawled.txt", JSON.stringify(crawledData));
  console.info('CRAWLING COMPLETE !');
}

function onErr(err) {
  console.error(err);
  return 1;
}


hitCrawl();