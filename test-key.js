console.log(Object.keys(process.env).filter(k => k.startsWith('GEMINI')));
console.log({
  len: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0
});
