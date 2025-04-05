import logging

from .environment import LOG_LEVEL


class ColoredFormatter(logging.Formatter):
    white = "\x1b[1;37;20m"
    grey = "\x1b[1;38;20m"
    yellow = "\x1b[1;33;20m"
    red = "\x1b[1;31;20m"
    bold_red = "\x1b[1;31;1m"
    reset = "\x1b[1;0m"
    format = "%(levelname)s: %(message)s (%(filename)s:%(lineno)d)"

    FORMATS = {
        logging.DEBUG: grey + format + reset,
        logging.INFO: white + format + reset,
        logging.WARNING: yellow + format + reset,
        logging.ERROR: red + format + reset,
        logging.CRITICAL: bold_red + format + reset,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)


def getLogger(name: str = "blender_vs"):
    logging.getLogger().setLevel(LOG_LEVEL)

    log = logging.getLogger(name)
    if log.handlers:
        # log is already configured
        return log
    log.propagate = False
    log.setLevel(LOG_LEVEL)

    # create console handler with a higher log level
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)

    ch.setFormatter(ColoredFormatter())

    log.addHandler(ch)

    return log
