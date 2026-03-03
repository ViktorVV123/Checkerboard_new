declare module '*.module.scss' {
    interface IClassNames {
        [className: string]: string
    }
    const classNames: IClassNames;
    export = classNames;
}



declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module "*.svg" { //для подсказки что передавать в svg можно было бы
    import React from "react";
    const SVG: React.FC<React.SVGProps<SVGSVGElement>>;
    export default SVG;
}
declare const __PLATFORM__: 'mobile' | 'dekstop'
declare const __ENV__: 'production' | 'development'