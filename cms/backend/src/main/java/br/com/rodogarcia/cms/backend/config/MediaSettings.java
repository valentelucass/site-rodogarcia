package br.com.rodogarcia.cms.backend.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public final class MediaSettings {

    private final String ffmpegPath;
    private final String ffprobePath;
    private final int webpQuality;
    private final int webpThumbQuality;
    private final int webpMediumWidth;
    private final int webpLargeWidth;
    private final int webpOptimizedWidth;

    @Autowired
    public MediaSettings(CmsProperties properties) {
        this.ffmpegPath = properties.ffmpegPath();
        this.ffprobePath = properties.ffprobePath();
        this.webpQuality = properties.mediaWebpQuality();
        this.webpThumbQuality = properties.mediaWebpThumbQuality();
        this.webpMediumWidth = properties.mediaWebpMediumWidth();
        this.webpLargeWidth = properties.mediaWebpLargeWidth();
        this.webpOptimizedWidth = properties.mediaWebpOptimizedWidth();
    }

    MediaSettings(
        String ffmpegPath,
        String ffprobePath,
        int webpQuality,
        int webpThumbQuality,
        int webpMediumWidth,
        int webpLargeWidth,
        int webpOptimizedWidth
    ) {
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
        this.webpQuality = webpQuality;
        this.webpThumbQuality = webpThumbQuality;
        this.webpMediumWidth = webpMediumWidth;
        this.webpLargeWidth = webpLargeWidth;
        this.webpOptimizedWidth = webpOptimizedWidth;
    }

    public static MediaSettings defaults(String ffmpegPath) {
        return defaults(ffmpegPath, "");
    }

    public static MediaSettings defaults(String ffmpegPath, String ffprobePath) {
        return new MediaSettings(ffmpegPath, ffprobePath, 82, 72, 960, 1_440, 1_920);
    }

    public String ffmpegPath() {
        return ffmpegPath;
    }

    public String ffprobePath() {
        return ffprobePath;
    }

    public int webpQuality() {
        return webpQuality;
    }

    public int webpThumbQuality() {
        return webpThumbQuality;
    }

    public int webpMediumWidth() {
        return webpMediumWidth;
    }

    public int webpLargeWidth() {
        return webpLargeWidth;
    }

    public int webpOptimizedWidth() {
        return webpOptimizedWidth;
    }

}
