# Datasheets

PDFs in this folder are served by the website, so their links never break
when a manufacturer changes their own site.

## Adding a datasheet

1. On GitHub, open this `datasheets` folder and choose **Add file → Upload files**.
2. Drag in the PDF and click **Commit changes**.
3. In the Google Sheet, put the path in the datasheet cell instead of the
   manufacturer's link, for example:

   ```
   datasheets/seceuroglide-mini-product.pdf
   ```

The site updates a few minutes after the upload. The sheet change shows up
straight away (Google can take a few minutes to republish).

## File naming

- Use lowercase, with hyphens instead of spaces: `excel-77-technical.pdf`
- Start with the model name so files sort together.
- Add what it is at the end: `-product`, `-technical`, `-wiring`, `-manual`.
- GitHub won't take a single file over 100 MB; datasheets are normally far smaller.

Before uploading, check the manufacturer allows their datasheets to be shared
(most do).
