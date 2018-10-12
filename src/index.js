const axios = require("axios").default;
const fs = require("fs-extra");
const path = require("path");
const promiseLimit = require('promise-limit');
const cheerio = require("cheerio");
const HOME_URL = "http://www.batdongsan.vn/giao-dich/ban-nha-dat/pageindex-1.html";
const pageCount = 2; //398;
let listPage = [];

async function getHtml(url) {
    const response = await axios.get(url);
    return response.data;
}

async function getList(url) {
    console.log("Fetching ....", url);
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
    listPage = listPage.concat(data)
    return data;
}
async function fetch1Page(url) {
    console.log("getting content from ", url)
    const html = await getHtml(url);
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
    return {
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
        }
    }

}
async function fetchAllPages() {
    const pages = [];
    limit = promiseLimit(2)
    for (let i = 1; i <= pageCount; i++) {
        pages.push(`http://www.batdongsan.vn/giao-dich/ban-nha-dat/pageindex-${i}.html`)
    }

    const results = await Promise.all(pages.map((name) => {
        return limit(() => getList(name))
    }))
    //console.log('results:', results)
    console.log("found", listPage.length);
    fs.writeJSONSync(path.join(__dirname, "../data/list.json"), listPage, {
        spaces: 4
    });
    //const html = await getList(HOME_URL);
    return results;
}

//fetchAllPages().then(x => console.log("Done"))


fetch1Page("http://www.batdongsan.vn/ban-khach-san-3-sao-pho-hang-hanh-hoan-kiem-ha-noi-1895m2-no-hau-p240462.html").then(x => console.log(x));