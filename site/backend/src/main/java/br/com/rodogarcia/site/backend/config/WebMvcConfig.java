package br.com.rodogarcia.site.backend.config;

import org.springframework.util.AntPathMatcher;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.util.UrlPathHelper;

@Configuration(proxyBeanMethods = false)
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    @SuppressWarnings("removal") // O parser novo elimina ';' e quebra o contrato HTTP compatível com Express.
    public void configurePathMatch(PathMatchConfigurer configurer) {
        UrlPathHelper pathHelper = new UrlPathHelper() {
            @Override
            public String removeSemicolonContent(String requestUri) {
                // Mesmo com removeSemicolonContent=false, o helper padrão
                // remove ;jsessionid de forma especial. O Express mantém o
                // segmento literal e ele participa do route/path parameter.
                return requestUri;
            }
        };
        pathHelper.setAlwaysUseFullPath(true);
        pathHelper.setRemoveSemicolonContent(false);
        pathHelper.setUrlDecode(false);

        AntPathMatcher pathMatcher = new AntPathMatcher();
        pathMatcher.setCaseSensitive(false);

        configurer.setPatternParser(null);
        configurer.setUrlPathHelper(pathHelper);
        configurer.setPathMatcher(pathMatcher);
    }
}
