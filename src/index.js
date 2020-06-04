const axios = require('axios').default;
const chalk = require('chalk');
const fs = require('fs-extra');
const axiosRetry = require('axios-retry');
const path = require('path');
const promiseLimit = require('promise-limit');
const cheerio = require('cheerio');

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const HOME_URL =
  'http://www.batdongsan.vn/giao-dich/ban-nha-dat/pageindex-1.html';
const pageCount = 521;
const LIST_THREADS = 1;
const PAGE_THREADS = 10;
let listPage = [];

// let resetCount = 0;
async function getHtml(url) {
  const headers = {
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Cookie':
      'ASP.NET_SessionId=hnsdv2egk2ajpsbxxmc1musn; _ga=GA1.2.1118061033.1591276158; _gid=GA1.2.321159832.1591276158; __tawkuuid=e::batdongsan.vn::Mt1VHIvmiUj4GQF4gKbmjLfXCoLxP9JeOQyyaWaskSo1/lgbK9CqkJ7VV7LJWTK/::2; __gads=ID=bb8125279f3fb345:T=1591276654:S=ALNI_MbbC832yazLxyQG0Y1JvETx8sjXkg; TawkConnectionTime=0',
    'Upgrade-Insecure-Requests': 1,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
  };
  // if (resetCount++ % 15 == 0) {
  //     await axios.get("http://www.batdongsan.vn/default.aspx?removedos=true")
  // }
  let response = await axios.get(url, {
    timeout: 30000,
    headers,
  });
  if (
    response.data.indexOf(
      'http://www.batdongsan.vn/default.aspx?removedos=true'
    ) > 0
  ) {
    await axios.get('http://www.batdongsan.vn/default.aspx?removedos=true');
    response = await axios.get(url);
  }
  return response.data;
}

async function getList(url) {
  console.log('Fetching list page from url', url);
  const html = await getHtml(url);
  const $ = cheerio(html);
  const list = $.find('ul .content1');
  const data = [];
  list.each((index, el) => {
    const div = cheerio('.al_author_tool', el);
    data.push({
      title: cheerio('h2', el).text().trim(),
      link: 'http://www.batdongsan.vn' + cheerio('h2 a', el).attr('href'),
      content: cheerio('h3', el).text().trim(),
      price: cheerio('.button-price', el).text().trim(),
      author: div.find('a').text().trim(),
      date: div.find('.fa-clock-o').parent().text().trim(),
      area: cheerio('.product-area', el).text().trim(),
      location: cheerio('product-area', el).next().text().trim(),
    });
  });
  //console.log(url, data.length)
  listPage = listPage.concat(data);
  const pageLimit = promiseLimit(PAGE_THREADS);
  const results = await Promise.all(
    data.map((item) => {
      return pageLimit(() => fetch1Page(item.link));
    })
  );
  return data;
}
async function fetch1Page(url) {
  console.log('Page:', url);
  try {
    const html = await getHtml(encodeURI(url));
    const $ = cheerio.load(html);
    const details = $('.details-warp-item');
    const props = {};
    details.each((index, el) => {
      props[$('label', el).text().trim()] = $('span', el).text().trim();
    });
    const attributes = $('.attribute li');
    attributes.each((index, el) => {
      props[$('.attributename', el).text().trim()] = $('.attributevalue', el)
        .text()
        .trim();
    });
    const images = [];
    const imageEls = $('.box-banner-img a');
    imageEls.each((index, el) => {
      const imageUrl = $(el).attr('href');
      images.push(imageUrl);
    });
    const page = {
      title: $('.P_Title1').text().trim(),
      price: $('.Price').text().trim(),
      area: $('.Area').text().trim(),
      address: $('.Addrees').text().trim(),
      date: $('.PostDate').text().trim(),
      content: $('.PD_Gioithieu').text().trim(),
      props,
      contact: {
        name: $($('.P_Items_Lienhe .name a')[0]).text().trim(),
        email: $($('.P_Items_Lienhe .email')[0]).text().trim(),
        phone: $($('.P_Items_Lienhe .phone')[0]).text().trim(),
      },
      images,
    };
    console.log(chalk.green('Success: ' + url));
    fs.writeJSONSync(
      path.join(__dirname, '../data/pages', path.basename(url) + '.json'),
      page,
      {
        spaces: 4,
      }
    );
    return page;
  } catch (err) {
    //  console.log(err);
    console.log(chalk.red('Failed to get page content: ' + url));
  }
}
async function fetchAllPages() {
  const pages = [];
  limit = promiseLimit(LIST_THREADS);
  for (let i = 1; i <= pageCount; i++) {
    pages.push(
      `http://www.batdongsan.vn/giao-dich/ban-nha-dat/pageindex-${i}.html`
    );
  }

  const results = await Promise.all(
    pages.map((name) => {
      return limit(() => getList(name));
    })
  );
  //console.log('results:', results)
  console.log('total page found: ', listPage.length);
  fs.writeJSONSync(path.join(__dirname, '../data/list.json'), listPage, {
    spaces: 4,
  });
  //const html = await getList(HOME_URL);
  return results;
}

/* MAIN FUNCTION*/
fs.mkdirsSync(path.resolve('data/pages'));

fetch1Page(
  'http://www.batdongsan.vn/toi-xay-nha-ban-233-ty-phuong-linh-xuan-dt-30m2-1t-2l-goi-toi-ngay-chu-p469126.html'
).then(console.log);

fetchAllPages().then((x) => console.log('Done'));
