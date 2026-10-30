export function demoData(){
 const started=Date.parse('2026-10-30T02:00:00Z');
 const entry=(seconds,url,body,status=204)=>({startedDateTime:new Date(started+seconds*1000).toISOString(),time:42+seconds,request:{method:body?'POST':'GET',url,headers:[{name:'Referer',value:'https://demo.example.com/hotel/'}],...(body?{postData:{mimeType:'application/json',text:JSON.stringify(body)}}:{})},response:{status}});
 const har={log:{version:'1.2',creator:{name:'Event QA demo',version:'1.0'},entries:[
  entry(0,'https://www.google-analytics.com/g/collect?v=2&en=page_view&dl=https%3A%2F%2Fdemo.example.com%2Fhotel%2F'),
  entry(2,'https://www.google-analytics.com/g/collect?v=2&en=search_submit&ep.search_term=Da%20Nang&ep.service=hotel'),
  entry(2.5,'https://www.google-analytics.com/g/collect?v=2&en=search_submit&ep.search_term=Da%20Nang&ep.service=hotel'),
  entry(4,'https://unification.useinsider.com/api/event/v1',{partner:'demo_partner',events:[{event_name:'listing_page_view',event_params:{custom:{service:'golf',item_count:12}}}]}),
  entry(7,'https://www.google-analytics.com/g/collect?v=2&en=select_item&ep.item_id=HOTEL-102&ep.service=hotel',null,500),
  entry(9,'https://www.google-analytics.com/g/collect?v=2&en=scroll&epn.percent_scrolled=90'),
  entry(10,'https://demo.example.com/assets/logo.svg'),
  entry(11,'https://demo.example.com/api/hotels',{query:'Da Nang'},200)
 ]}};
 const specs={cases:[
  {id:'DEMO-01',name:'Xem trang khách sạn',source:'GA4',flow:'Hotel',rules:[{event_name:'page_view',layer:'TRACKING_REQUEST',fields:{event:{op:'eq',value:'page_view'},dl:{op:'type',value:'string'}}}]},
  {id:'DEMO-02',name:'Tìm kiếm khách sạn',source:'GA4',flow:'Hotel',rules:[{event_name:'search_submit',layer:'TRACKING_REQUEST',fields:{search_term:{op:'type',value:'string'},service:{op:'eq',value:'hotel'},destination_id:{op:'exists'}}}]},
  {id:'DEMO-03',name:'Xem danh sách Golf',source:'Insider',flow:'Golf',rules:[{event_name:'listing_page_view',layer:'TRACKING_REQUEST',fields:{'event_params.custom.service':{op:'eq',value:'golf'},'event_params.custom.item_count':{op:'type',value:'number'}}}]},
  {id:'DEMO-04',name:'Chọn khách sạn',source:'GA4',flow:'Hotel',rules:[{event_name:'select_item',layer:'TRACKING_REQUEST',fields:{item_id:{op:'exists'}}}]},
  {id:'DEMO-05',name:'Bắt đầu thanh toán',source:'Insider',flow:'Merchandise',rules:[{event_name:'merchandise_checkout',layer:'TRACKING_REQUEST',fields:{sid:{op:'exists'}}}]}
 ]};return{har,specs};
}
