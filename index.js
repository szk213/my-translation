import { split, Syntax } from "sentence-splitter";
import { chromium } from 'playwright'
import fetch from 'node-fetch';
const fs = require('fs').promises;

const resourceTypeDescriptionSelector = "#main-col-body > p:nth-of-type(1)";
const resourcePropertiesSelector = "#main-col-body > div.variablelist > dl > dt";
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

const fetchResourceTypeDescription = async (page)=>{
    await page.waitForSelector(resourceTypeDescriptionSelector)
    return await page.evaluate(el => el.innerText, await page.$(resourceTypeDescriptionSelector))
}

const fetchProperties = async (page)=>{
    const propertiesSelectorHandlers = await page.$$(resourcePropertiesSelector)
    // 一旦プロパティのリストを取得してサイズを取得
    const propertiesSize = propertiesSelectorHandlers.length
    return Promise.all([...Array(propertiesSize).keys()].map(async index=>{
        const propertySelector = `#main-col-body > div.variablelist > dl > dt:nth-of-type(${index + 1})`
        const propertyDescriptionSelector = `#main-col-body > div.variablelist > dl > dd:nth-of-type(${index + 1}) > p:nth-of-type(1)`
        // プロパティ名を取得
        const property = await page.evaluate(el => el.innerText, await page.$(propertySelector))
        // プロパティの説明を取得
        const description = await page.evaluate(el => el.innerText, await page.$(propertyDescriptionSelector))
        return {
            property,
            description
        }
    }))
}

const translationToJa = async (text)=>{
    let sentences = split(text);
    var translatedSentences = await Promise.all(sentences.map(async (c)=>{
        if(c.type!="Sentence"){
            return
        }

        const url = encodeURI(`https://script.google.com/macros/s/AKfycbxzIiZbuc7WutcqY3ccxzxweymw89nYUuJBO9SNcxmtr-OP73anhSPyDMGhTvtvQp8p6A/exec?text=${c.raw}&source=en&target=ja`)
        const res = await fetch(url);
        const respJson = await res.json()
        return respJson.text;
    }));
    return translatedSentences.filter(Boolean)
}

const fetchResourceTypeData = async (resourceType, page)=>{
    await page.goto(resourceType.Documentation);
    // リソースタイプの説明を取得
    const resourceTypeDescription = await fetchResourceTypeDescription(page)
    resourceType.Description = resourceTypeDescription
    resourceType.TranslatedDescriptionSentences = await translationToJa(resourceTypeDescription)

    if(!resourceType.Properties){
        console.log(resourceType)
        return
    }

    if(!Object.keys(resourceType.Properties)){
        console.log(resourceType)
        return
    }

    // プロパティの説明を取得
    const properties = await fetchProperties(page)
    for (const [key, value] of Object.entries(resourceType.Properties)) {
        if(properties.find(p=>p.property==key)){
            value.Description = properties.find(p=>p.property==key).description
            if(value.Description){
                value.TranslatedDescriptionSentences = await translationToJa(value.Description)
            }
        }
    }
    return resourceType
}

(async () => {
    const res = await fetch('https://d33vqc0rt9ld30.cloudfront.net/latest/gzip/CloudFormationResourceSpecification.json');
    const json = await res.json();

    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
    })

    const context = await browser.newContext();
    const page = await context.newPage();

    for (const [key, value] of Object.entries(json.PropertyTypes)) {
        console.log(`start:${key}`)
        const responseType = await fetchResourceTypeData(value,page)
        try {
            await fs.writeFile(`./output/${key.replace(/:/g, '_')}.json`, JSON.stringify(responseType));
            console.log(`${key}.jsonが作成されました`);
        } catch(err) {
            console.log(err.toString());
        }
        sleep(500)

        console.log(`end:${key}`)
    }

    try {
        await fs.writeFile(`./output/all.json`, JSON.stringify(json));
        console.log('all.jsonが作成されました');
    } catch(err) {
        console.log(err.toString());
    }
 

    // const data = await fetchResourceTypeData(json.PropertyTypes["AWS::AppMesh::VirtualRouter.PortMapping"],page)
    // console.log(data)
    // await page.goto('https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-accessanalyzer-analyzer.html');
    // const resourceTypeDescription = await fetchResourceTypeDescription(page)
    // const properties = await fetchProperties(page)
    // // console.log(resourceTypeDescription)
    // const translatedDescriptionSentences = await translationToJa(resourceTypeDescription)
    // const props = await Promise.all(properties.map(async (property)=>
    //     property.translatedDescriptionSentences = await translationToJa(property.description)
    // ))
    // console.log(properties)

    await browser.close();



    // // console.log(Object.keys(json.PropertyTypes))
    // const resa = await fetch('https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-accessanalyzer-analyzer.html')
    // const html = await resa.text();
    // const dom = new JSDOM(html);
    // const document = dom.window.document;
    // // const nodes = document.querySelectorAll(resourcePropertiesSelector);

    // const des = document.querySelector(resourceTypeDescriptionSelector).innerText
    // const nodes = document.querySelectorAll("#main-col-body");

    
    // const tokyoWeathers = Array.from(nodes, td => td.textContent.trim());
    // let sentences = split(des);

    // console.log(JSON.stringify(sentences))

    // var a = sentences.forEach(sentence=>{
    //     if(c.type!="Sentence"){
    //         return c.raw
    //     }


    //     const url = encodeURI(`https://script.google.com/macros/s/AKfycbxzIiZbuc7WutcqY3ccxzxweymw89nYUuJBO9SNcxmtr-OP73anhSPyDMGhTvtvQp8p6A/exec?text=${c.raw}&source=en&target=ja`)
    //     const res = await fetch(url);
    //     return `#${c.raw}#` 
    // })

    // var a = await Promise.all(sentences.map(async (c)=>{
    //     if(c.type!="Sentence"){
    //         return c.raw
    //     }

    //     const url = encodeURI(`https://script.google.com/macros/s/AKfycbxzIiZbuc7WutcqY3ccxzxweymw89nYUuJBO9SNcxmtr-OP73anhSPyDMGhTvtvQp8p6A/exec?text=${c.raw}&source=en&target=ja`)
    //     const res = await fetch(url);
    //     const respJson = await res.json()
    //     console.log(respJson.text)
    //     return respJson.text;
    // }));

    // var a = sentences.map(c=>{
    //     encodeURI
    //     if(c.type!="Sentence"){
    //         return c.raw
    //     }

    //     return `#${c.raw}#` 
    // })

    // console.log(JSON.stringify(a))
})();

