const axios = require("axios").default;
const chalk = require('chalk');
const fs = require("fs-extra");
const path = require("path");
const promiseLimit = require('promise-limit');
const cheerio = require("cheerio");
const HOME_URL = "http://www.batdongsan.vn/giao-dich/ban-nha-dat/pageindex-1.html";
const pageCount = 398;
const LIST_THREADS = 5;
const PAGE_THREADS = 5;
let listPage = [];

// let resetCount = 0;
async function getHtml(url) {
    // if (resetCount++ % 15 == 0) {
    //     await axios.get("http://www.batdongsan.vn/default.aspx?removedos=true")
    // }
    let response = await axios.get(url);
    if (response.data.indexOf("http://www.batdongsan.vn/default.aspx?removedos=true") > 0) {
        await axios.get("http://www.batdongsan.vn/default.aspx?removedos=true")
        response = await axios.get(url);
    };
    return response.data;
}

async function getList(url) {
    console.log("Fetching list page from url", url);
    const html = await getHtml(url);
    const $ = cheerio(html);
    const list = $.find("ul .content1");
    const data = [];
    list.each((index, el) => {
        const div = cheerio(".al_author_tool", el);
        data.push({
            title: cheerio("h2", el).text().trim(),
            link: "http://www.batdongsan.vn" + cheerio("h2 a", el).attr("href"),
            content: cheerio("h3", el).text().trim(),
            price: cheerio(".button-price", el).text().trim(),
            author: div.find("a").text().trim(),
            date: div.find(".fa-clock-o").parent().text().trim(),
            area: cheerio(".product-area", el).text().trim(),
            location: cheerio("product-area", el).next().text().trim()
        })
    })
    //console.log(url, data.length)
    listPage = listPage.concat(data)
    const pageLimit = promiseLimit(PAGE_THREADS);
    const results = await Promise.all(data.map((item) => {
        return pageLimit(() => fetch1Page(item.link))
    }))
    return data;
}
async function fetch1Page(url) {
    console.log("getting content from ", url)
    try {
        const html = await getHtml(encodeURI(url));
        const $ = cheerio.load(html);
        const details = $(".details-warp-item");
        const props = {};
        details.each((index, el) => {
            props[$("label", el).text().trim()] = $("span", el).text().trim()
        })
        const attributes = $(".attribute li");
        attributes.each((index, el) => {
            props[$(".attributename", el).text().trim()] = $(".attributevalue", el).text().trim()
        })
        const images = [];
        const imageEls = $(".box-banner-img a");
        imageEls.each((index, el) => {
            const imageUrl = $(el).attr("href");
            images.push(imageUrl);
        })
        const page = {
            title: $(".P_Title1").text().trim(),
            price: $(".Price").text().trim(),
            area: $(".Area").text().trim(),
            address: $(".Addrees").text().trim(),
            date: $(".PostDate").text().trim(),
            content: $(".PD_Gioithieu").text().trim(),
            props,
            contact: {
                name: $($(".P_Items_Lienhe .name a")[0]).text().trim(),
                email: $($(".P_Items_Lienhe .email")[0]).text().trim(),
                phone: $($(".P_Items_Lienhe .phone")[0]).text().trim(),
            },
            images
        }
        fs.writeJSONSync(path.join(__dirname, "../data/pages", path.basename(url) + ".json"), page, {
            spaces: 4
        })
        return page;
    } catch (err) {
        console.log(chalk.red("Failed to get page content: " + url))
    }

}
async function fetchAllPages() {
    const pages = [];
    limit = promiseLimit(LIST_THREADS)
    for (let i = 1; i <= pageCount; i++) {
        pages.push(`http://www.batdongsan.vn/giao-dich/ban-nha-dat/pageindex-${i}.html`)
    }

    const results = await Promise.all(pages.map((name) => {
        return limit(() => getList(name))
    }))
    //console.log('results:', results)
    console.log("total page found: ", listPage.length);
    fs.writeJSONSync(path.join(__dirname, "../data/list.json"), listPage, {
        spaces: 4
    });
    //const html = await getList(HOME_URL);
    return results;
}


/* MAIN FUNCTION*/
if (!fs.pathExistsSync("../data")) {
    fs.mkdirpSync("../data");
    fs.mkdirpSync("../data/pages");
}

fetchAllPages().then(x => console.log("Done"))


//fetch1Page("http://www.batdongsan.vn/ban-khach-san-3-sao-pho-hang-hanh-hoan-kiem-ha-noi-1895m2-no-hau-p240462.html").then(x => console.log(x));