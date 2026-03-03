import path from 'path';
import webpack from 'webpack';  //для появление процентов сборки (в продакшен не советуют он может замедлять сборку)
import {buildWebpack} from "./config/build/buildWebpack";
import {BuildPath, Mode, ModePlatform} from "./config/build/types/types";


interface EnvVaribles {
    mode?: Mode;
    port?: number;
    analyzer?: boolean;
    platform?: ModePlatform;

}

export default (env: EnvVaribles) => {

    const isAnalyzer = process.argv.includes('--env===true');

    const paths: BuildPath = {
        output: path.resolve(__dirname, 'build'),
        entry: path.resolve(__dirname, 'src', 'index.tsx'),
        html: path.resolve(__dirname, 'public', 'index.html'),
        public: path.resolve(__dirname, 'public'),
        src: path.resolve(__dirname, 'src'),
    }

    const config: webpack.Configuration = buildWebpack({
            port: env.port ?? 3005,
            mode: env.mode ?? "development",
            paths,
            analyzer: isAnalyzer,
            platform: env.platform ?? 'desktop'
        }
    )
    return config
}