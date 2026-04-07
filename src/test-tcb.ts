import cloudbase from '@cloudbase/js-sdk';
const app = cloudbase.init({ env: 'test' });
const auth = app.auth();
console.log(Object.keys(auth.__proto__).concat(Object.keys(auth)));
