import _ from 'lodash';

console.log(_)

import(/* webpackChunkName: "page1" */'./routes/page1').then(comp => {
  console.log(comp)
})