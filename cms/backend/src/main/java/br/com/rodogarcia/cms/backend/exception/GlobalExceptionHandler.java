package br.com.rodogarcia.cms.backend.exception;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> handleApi(ApiException error) {
        return org.springframework.http.ResponseEntity
            .status(error.status())
            .body(Map.of("error", error.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> handleMalformedJson(
        HttpMessageNotReadableException ignored
    ) {
        return org.springframework.http.ResponseEntity
            .badRequest()
            .body(Map.of("error", "JSON inválido."));
    }

    @ExceptionHandler({MaxUploadSizeExceededException.class})
    public org.springframework.http.ResponseEntity<Map<String, String>> handlePayloadTooLarge(
        Exception ignored
    ) {
        return org.springframework.http.ResponseEntity
            .status(HttpStatus.CONTENT_TOO_LARGE)
            .body(Map.of("error", "Arquivo ou payload excede o limite permitido."));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> handleMediaType(
        HttpMediaTypeNotSupportedException ignored
    ) {
        return org.springframework.http.ResponseEntity
            .status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
            .body(Map.of("error", "Content-Type deve ser application/json."));
    }

    @ExceptionHandler(MultipartException.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> handleMultipart(
        MultipartException ignored
    ) {
        return org.springframework.http.ResponseEntity
            .unprocessableContent()
            .body(Map.of("error", "Upload multipart inválido."));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> handleMissingParameter(
        MissingServletRequestParameterException error
    ) {
        return org.springframework.http.ResponseEntity
            .unprocessableContent()
            .body(Map.of("error", "Parâmetro obrigatório ausente: " + error.getParameterName() + "."));
    }

    @ExceptionHandler({
        NoHandlerFoundException.class,
        NoResourceFoundException.class,
        HttpRequestMethodNotSupportedException.class
    })
    public org.springframework.http.ResponseEntity<Map<String, String>> handleNotFound(
        Exception ignored
    ) {
        return org.springframework.http.ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "Recurso não encontrado."));
    }

    @ExceptionHandler(Exception.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> handleUnexpected(
        Exception ignored
    ) {
        return org.springframework.http.ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "Erro interno no servidor."));
    }
}
