import React from 'react';

interface AdBannerProps {
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({ className = '' }) => {
  const iframeHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; }
        </style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : '21657b71df67ba748a6d4e39a6c14a00',
            'format' : 'iframe',
            'height' : 50,
            'width' : 320,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highperformanceformat.com/21657b71df67ba748a6d4e39a6c14a00/invoke.js"></script>
      </body>
    </html>
  `;

  return (
    <div className={`ad-container flex justify-center items-center w-full overflow-hidden ${className}`}>
      <iframe
        title="Ad Banner"
        srcDoc={iframeHtml}
        width="320"
        height="50"
        frameBorder="0"
        scrolling="no"
        className="max-w-full"
      ></iframe>
    </div>
  );
};
